document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const elements = {
        screens: {
            title: document.getElementById('title-screen'),
            story: document.getElementById('story-screen'),
            battle: document.getElementById('battle-screen'),
            result: document.getElementById('result-screen')
        },
        buttons: {
            start: document.getElementById('start-btn'),
            toAdventure: document.getElementById('to-adventure-btn'),
            retry: document.getElementById('retry-btn')
        },
        battleBtns: document.querySelectorAll('.battle-btn'),
        msgBox: document.getElementById('message-box'),
        hpBars: {
            hero: document.getElementById('hero-hp-bar'),
            enemy: document.getElementById('enemy-hp-bar')
        },
        hpTexts: {
            hero: document.getElementById('hero-hp-text')
        },
        sprites: {
            hero: document.getElementById('adventure-hero'),
            enemy: document.getElementById('adventure-enemy')
        },
        containers: {
            bgLayer: document.getElementById('bg-layer'),
            items: document.getElementById('items-container'),
            actionMenu: document.getElementById('action-menu'),
            controls: document.getElementById('adventure-controls'),
            enemyStatus: document.getElementById('enemy-status-box')
        },
        audio: {
            bgmTitle: document.getElementById('bgm-title'),
            bgmBattle: document.getElementById('bgm-battle'),
            seAttack: document.getElementById('se-attack'),
            seHeal: document.getElementById('se-heal'),
            seItem: document.getElementById('se-item'),
            seDamage: document.getElementById('se-damage')
        }
    };

    // --- State ---
    const MAX_HP_HERO = 100;
    const MAX_HP_ENEMY = 300;
    
    let state = {
        phase: 'title', // title, story, adventure, battle, result
        hpHero: MAX_HP_HERO,
        hpEnemy: MAX_HP_ENEMY,
        specialUses: 2,
        isPlayerTurn: true,
        isBattleOver: false,
        adventureDistance: 0,
        itemInterval: null,
        activeItems: []
    };

    // 悪魔の攻撃パターン
    const EnemyAttacks = [
        { name: "徹夜ダメージ", dmg: 15, msg: "魔王「レポート課題の刑だ！」\n徹夜で肌荒れが進行した！" },
        { name: "ジャンクフード", dmg: 20, msg: "魔王「深夜のカップ麺を食え！」\n皮脂が過剰分泌した！" },
        { name: "ストレスビーム", dmg: 25, msg: "魔王「将来の不安ビーム！」\nホルモンバランスが崩れた！" }
    ];

    // アイテムデータ
    const ItemTypes = [
        { id: 'beer', src: 'images/item_beer.png', type: 'bad', effect: -20, msg: "金麦！アルコールで肌荒れ加速...", name: "金麦" },
        { id: 'icecream', src: 'images/item_icecream.png', type: 'bad', effect: -15, msg: "31アイス！糖分でニキビが悪化...", name: "31アイス" },
        { id: 'patch', src: 'images/item_patch.png', type: 'good', effect: 15, msg: "ニキビパッチ！患部を保護した！", name: "ニキビパッチ" },
        { id: 'soba', src: 'images/item_soba.png', type: 'good', effect: 30, msg: "お蕎麦！ビタミンB群がお肌を整える！", name: "お蕎麦" }
    ];

    // --- Utilities ---
    const playSound = (type) => {
        try { if(elements.audio[type]) { elements.audio[type].currentTime=0; elements.audio[type].play().catch(()=>{}); } } catch(e){}
    };
    
    const playBGM = (type) => {
        try {
            elements.audio.bgmTitle.pause(); elements.audio.bgmBattle.pause();
            if(type) elements.audio[type].play().catch(()=>{});
        } catch(e){}
    };

    const showScreen = (screenId) => {
        Object.values(elements.screens).forEach(s => s.classList.remove('active'));
        elements.screens[screenId].classList.add('active');
    };

    const delay = ms => new Promise(res => setTimeout(res, ms));

    const typeMessage = async (text, speed=20) => {
        elements.msgBox.innerHTML = '';
        let html = '';
        const lines = text.split('\n');
        for (let j=0; j<lines.length; j++) {
            if (j>0) html += '<br>';
            for (let i = 0; i < lines[j].length; i++) {
                html += lines[j][i];
                elements.msgBox.innerHTML = html;
                if(state.phase === 'adventure') speed = 10; // アドベンチャー中は早め
                await delay(speed);
            }
        }
    };

    const updateUI = () => {
        let heroPct = Math.max(0, (state.hpHero / MAX_HP_HERO) * 100);
        let enemyPct = Math.max(0, (state.hpEnemy / MAX_HP_ENEMY) * 100);
        
        elements.hpBars.hero.style.width = `${heroPct}%`;
        elements.hpBars.enemy.style.width = `${enemyPct}%`;
        elements.hpBars.hero.style.background = heroPct < 30 ? '#e74c3c' : 'linear-gradient(90deg, #2ecc71, #27ae60)';
        elements.hpTexts.hero.innerText = `${Math.floor(state.hpHero)}/${MAX_HP_HERO}`;
        
        const spSpan = document.querySelector('.special .mp-cost');
        if(spSpan) spSpan.innerText = `残: ${state.specialUses}`;
        
        if(state.phase === 'battle') {
            document.querySelector('.special').disabled = (state.specialUses<=0 || !state.isPlayerTurn || state.isBattleOver);
            elements.battleBtns.forEach(btn => {
                if(!btn.classList.contains('special')) btn.disabled = (!state.isPlayerTurn || state.isBattleOver);
            });
        }
    };

    // --- Adventure Phase ---
    const spawnItem = () => {
        if(state.phase !== 'adventure') return;
        
        const itemDef = ItemTypes[Math.floor(Math.random() * ItemTypes.length)];
        const el = document.createElement('img');
        el.src = itemDef.src;
        el.className = `game-item item-${itemDef.type}`;
        
        // 高さをランダムに（ジャンプで取れる / スルーできる）
        const isHigh = Math.random() > 0.5;
        el.style.bottom = isHigh ? '150px' : '30px';
        
        elements.containers.items.appendChild(el);
        
        // スクロールアニメーショントリガー
        setTimeout(() => {
            el.style.left = '-20%';
        }, 50);

        // クックチェック処理
        el.addEventListener('click', async () => {
            if(el.dataset.claimed) return;
            el.dataset.claimed = "true";
            el.style.display = 'none';
            
            if(itemDef.effect > 0) {
                playSound('seItem');
                state.hpHero = Math.min(MAX_HP_HERO, state.hpHero + itemDef.effect);
                elements.sprites.hero.classList.add('heal-effect');
                setTimeout(()=>elements.sprites.hero.classList.remove('heal-effect'), 500);
            } else {
                playSound('seDamage');
                state.hpHero += itemDef.effect; // negative
                elements.sprites.hero.classList.add('damage-effect', 'shake');
                setTimeout(()=>elements.sprites.hero.classList.remove('damage-effect', 'shake'), 500);
            }
            typeMessage(itemDef.msg);
            updateUI();
            
            // HPゼロならゲームオーバー
            if(state.hpHero <= 0) {
                endAdventure(false);
            }
        });

        // 画面外に出たアイテムを削除
        setTimeout(() => {
            if(el.parentNode) el.parentNode.removeChild(el);
            state.adventureDistance++;
            if(state.adventureDistance > 4 && state.phase === 'adventure') {
                endAdventure(true); // ボス戦へ
            }
        }, 3000);
    };

    const startAdventure = async () => {
        state.phase = 'adventure';
        state.hpHero = MAX_HP_HERO;
        state.hpEnemy = MAX_HP_ENEMY;
        state.adventureDistance = 0;
        updateUI();
        
        showScreen('battle');
        elements.containers.bgLayer.classList.add('scrolling');
        elements.sprites.hero.classList.add('walking');
        elements.sprites.enemy.style.display = 'none';
        elements.containers.enemyStatus.style.visibility = 'hidden';
        elements.containers.enemyStatus.style.opacity = '0';
        elements.containers.actionMenu.style.display = 'none';
        elements.containers.controls.style.display = 'block';
        elements.containers.items.innerHTML = '';
        
        playBGM('bgmBattle');
        await typeMessage("デート前の最終チェック！\nスクロールしてくるアイテムをタップだ！");
        
        state.itemInterval = setInterval(spawnItem, 2000);
    };

    const endAdventure = async (reachedBoss) => {
        clearInterval(state.itemInterval);
        elements.containers.bgLayer.classList.remove('scrolling');
        elements.sprites.hero.classList.remove('walking');
        elements.containers.items.innerHTML = '';
        
        if(!reachedBoss) {
            // ゲームオーバー（道中で倒れた）
            await handleGameOver("道中の誘惑に負けてしまった…\nお肌ボロボロでデートはキャンセル…");
            return;
        }

        // ボス戦へ移行
        state.phase = 'battle';
        state.isPlayerTurn = true;
        state.isBattleOver = false;
        elements.containers.controls.style.display = 'none';
        
        // 魔王登場演出
        elements.sprites.enemy.style.display = 'block';
        elements.sprites.enemy.style.right = '-50%';
        await delay(100);
        elements.sprites.enemy.style.transition = 'right 1s ease-out';
        elements.sprites.enemy.style.right = '5%';
        
        playSound('seDamage');
        await delay(1000);
        elements.sprites.enemy.classList.add('floating');
        
        elements.containers.enemyStatus.style.visibility = 'visible';
        elements.containers.enemyStatus.style.opacity = '1';
        elements.containers.actionMenu.style.display = 'grid';
        
        await typeMessage("「ついにここまで来たか！」\n巨大な顎ニキビ魔王が立ちはだかった！");
        updateUI();
    };

    // --- Battle Logic ---
    const checkWinLoss = async () => {
        if (state.hpEnemy <= 0) {
            state.isBattleOver = true;
            playBGM(null);
            playSound('seHeal');
            elements.sprites.enemy.classList.remove('floating');
            elements.sprites.enemy.classList.add('flash');
            await typeMessage("魔王を撃破した！\nニキビは根絶やしになった！");
            await delay(1000);
            document.getElementById('result-title').innerText = "デート大成功！";
            document.getElementById('result-title').style.color = "#2ecc71";
            document.getElementById('result-desc').innerHTML = "完璧なコンディションでデートに臨んだ！<br>君の青春は守られた！";
            showScreen('result');
            return true;
        } else if (state.hpHero <= 0) {
            await handleGameOver("「ああ…赤く腫れ上がって痛い…」\nマッシュの僕は絶望した。");
            return true;
        }
        return false;
    };

    const handleGameOver = async (msgText) => {
        state.isBattleOver = true;
        playBGM(null);
        elements.sprites.hero.classList.add('shake', 'damage-effect');
        await typeMessage(msgText);
        await delay(1000);
        document.getElementById('result-title').innerText = "デートキャンセルの危機";
        document.getElementById('result-title').style.color = "#e74c3c";
        document.getElementById('result-desc').innerHTML = "こんなブツブツ顔じゃ人前に出られない…<br>布団をかぶって泣く泣く引きこもった。";
        showScreen('result');
    };

    const enemyTurn = async () => {
        if (await checkWinLoss()) return;
        
        state.isPlayerTurn = false;
        updateUI();
        await delay(800);

        const attack = EnemyAttacks[Math.floor(Math.random() * EnemyAttacks.length)];
        
        await typeMessage(attack.msg);
        
        // 敵のアニメーション
        elements.sprites.enemy.style.transform = "scale(1.1) translateX(-20px)";
        setTimeout(()=> { elements.sprites.enemy.style.transform = "scale(1) translateX(0)"; }, 300);
        await delay(300);

        playSound('seDamage');
        elements.sprites.hero.classList.add('shake', 'damage-effect');
        setTimeout(() => elements.sprites.hero.classList.remove('shake', 'damage-effect'), 500);
        
        state.hpHero -= attack.dmg;
        updateUI();

        if (await checkWinLoss()) return;

        await delay(1000);
        await typeMessage("君のターンだ！どうする？");
        state.isPlayerTurn = true;
        updateUI();
    };

    const doAction = async (action) => {
        if (!state.isPlayerTurn || state.isBattleOver) return;
        state.isPlayerTurn = false;
        updateUI();

        if (action === 'attack') {
            await typeMessage("「洗顔バッシュ！」\n丁寧に泡立てて優しく攻める！");
            elements.sprites.hero.classList.add('attack-move');
            setTimeout(()=>elements.sprites.hero.classList.remove('attack-move'), 500);
            await delay(250);
            playSound('seAttack');
            elements.sprites.enemy.classList.add('flash', 'shake');
            setTimeout(() => elements.sprites.enemy.classList.remove('flash', 'shake'), 300);
            const dmg = 35 + Math.floor(Math.random() * 10);
            state.hpEnemy -= dmg;
            await delay(600);
            await typeMessage(`魔王に ${dmg} のダメージ！`);
        } 
        else if (action === 'heal') {
            await typeMessage("「高級化粧水ヒール！」\n肌に潤いとバリアを与えた！");
            playSound('seHeal');
            elements.sprites.hero.classList.add('heal-effect');
            setTimeout(() => elements.sprites.hero.classList.remove('heal-effect'), 500);
            const healAmt = 45;
            state.hpHero = Math.min(MAX_HP_HERO, state.hpHero + healAmt);
            await delay(800);
            await typeMessage(`HPが ${healAmt} 回復した！`);
        }
        else if (action === 'special') {
            if (state.specialUses <= 0) {
                state.isPlayerTurn = true;
                updateUI();
                return;
            }
            state.specialUses--;
            await typeMessage("奥義！「皮膚科のエピデュオゲル！」\n圧倒的な殺菌・ピーリング効果！");
            elements.sprites.hero.classList.add('attack-move');
            setTimeout(()=>elements.sprites.hero.classList.remove('attack-move'), 500);
            await delay(250);
            playSound('seAttack');
            setTimeout(()=>playSound('seAttack'), 200);
            elements.sprites.enemy.classList.add('shake', 'flash', 'damage-effect');
            setTimeout(() => {
                 elements.sprites.enemy.classList.remove('shake', 'flash', 'damage-effect');
            }, 600);
            const dmg = 120 + Math.floor(Math.random() * 30);
            state.hpEnemy -= dmg;
            await delay(1000);
            await typeMessage(`魔王に ${dmg} の大ダメージ！！`);
        }

        updateUI();
        await delay(800);
        enemyTurn();
    };

    // --- Events ---
    elements.buttons.start.addEventListener('click', () => {
        playBGM('bgmTitle');
        showScreen('story');
    });

    elements.buttons.toAdventure.addEventListener('click', () => {
        startAdventure();
    });

    elements.buttons.retry.addEventListener('click', () => {
        showScreen('title');
    });

    elements.battleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            doAction(e.currentTarget.dataset.action);
        });
    });

    // Boot
    showScreen('title');
});
