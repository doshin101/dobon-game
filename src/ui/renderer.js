import { DobonGame } from '../logic/game.js';

/**
 * ゲームUIの描画と操作を管理するクラス
 */
class GameRenderer {
    constructor() {
        this.game = new DobonGame();
        this.selectedIndices = []; // 選択中のカードインデックス
        this.setupElements();
        this.setupEventListeners();
        this.init();
    }

    setupElements() {
        this.elements = {
            you: document.getElementById('you'),
            cpu1: document.getElementById('cpu1'),
            cpu2: document.getElementById('cpu2'),
            cpu3: document.getElementById('cpu3'),
            userHand: document.getElementById('user-hand'),
            stockCount: document.querySelector('#stock .count'),
            discardPile: document.getElementById('discard'),
            announcement: document.getElementById('announcement'),
            btnDraw: document.getElementById('btn-draw'),
            btnPass: document.getElementById('btn-pass'),
            btnDbon: document.getElementById('btn-dbon')
        };
    }

    setupEventListeners() {
        this.elements.btnDraw.addEventListener('click', () => this.handleDraw());
        this.elements.btnPass.addEventListener('click', () => this.handlePass());
        this.elements.btnDbon.addEventListener('click', () => this.handleDbon());
    }

    async init() {
        this.game.initGame();
        this.renderAll();

        // CheckStartフェーズのUI演出 (B04)
        await this.handleStartCheckUI();

        this.renderAll();

        // YOUのターンでなければCPUを動かす
        if (!this.game.isGameOver && this.game.players[this.game.currentPlayerIndex].isCpu) {
            this.processGameLoop();
        }
    }

    /**
     * セット開始時の特殊判定UI（ダブルリーチ等）
     */
    async handleStartCheckUI() {
        const user = this.game.players[0];
        const userSum = user.hand.reduce((s, c) => s + c.value, 0);

        if (userSum <= 13) {
            this.showAnnouncement("DOUBLE REACH CHANCE?");
            // ダブルリーチボタンを活性化して3秒待機 (B04)
            this.elements.btnDbon.textContent = "DOUBLE REACH";
            this.elements.btnDbon.classList.remove('hidden');
            this.elements.btnDbon.onclick = () => {
                this.game.doubleReachFlags.add(0);
                this.showAnnouncement("YOU: DOUBLE REACH!");
                this.elements.btnDbon.classList.add('hidden');
            };

            await new Promise(resolve => setTimeout(resolve, 3000));
            this.elements.btnDbon.classList.add('hidden');
            this.elements.btnDbon.onclick = () => this.handleDbon(); // 戻す
            this.elements.btnDbon.textContent = "DOBON!";
        } else {
            this.showAnnouncement(`SET ${this.game.setCount} START`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    /**
     * ゲーム全体の再描画
     */
    renderAll() {
        this.renderPlayers();
        this.renderUserHand();
        this.renderTable();
        this.updateControls();
    }

    /**
     * プレイヤー情報（名前・ポイント・手札枚数）の描画
     */
    renderPlayers() {
        this.game.players.forEach(p => {
            const slot = document.getElementById(p.id === 0 ? 'you' : `cpu${p.id}`);
            if (!slot) return;

            // ポイント更新
            slot.querySelector('.points').textContent = `${p.points}pts`;

            // CPU固有の描画
            if (p.isCpu) {
                const info = slot.querySelector('.player-info');
                const handMini = slot.querySelector('.hand-mini');

                // 名前とポイントを縦に並べる
                info.innerHTML = `
                    <span class="name">${p.name}</span>
                    <span class="points">${p.points}pts</span>
                `;

                handMini.innerHTML = '';
                for (let i = 0; i < p.hand.length; i++) {
                    const cardBack = document.createElement('div');
                    cardBack.className = 'card-back-mini';
                    handMini.appendChild(cardBack);
                }
            }

            // アクティブなプレイヤーのハイライト
            if (this.game.currentPlayerIndex === p.id) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        });
    }

    /**
     * 自分の手札の描画
     */
    renderUserHand() {
        const user = this.game.players[0];
        this.elements.userHand.innerHTML = '';

        user.hand.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = `card ${this.getCardColor(card.suit)}`;
            if (this.game.currentPlayerIndex === 0 && this.game.canPlay(card)) {
                cardEl.classList.add('playable');
            } else if (this.game.currentPlayerIndex === 0) {
                cardEl.classList.add('dimmed');
            }

            cardEl.innerHTML = `<span>${card.displayName}</span>`;

            // 選択状態の表示
            if (this.selectedIndices.includes(index)) {
                cardEl.classList.add('selected');
            }

            cardEl.addEventListener('click', () => this.toggleSelect(index));
            this.elements.userHand.appendChild(cardEl);
        });
    }

    toggleSelect(index) {
        if (this.game.currentPlayerIndex !== 0) return;

        const player = this.game.players[0];
        const targetCard = player.hand[index];

        // 手札内に同じ数字のカードが他にもあるかチェック (単数/複数モードの分岐条件)
        const sameRankCards = player.hand.filter(c => c.rank === targetCard.rank);

        if (sameRankCards.length === 1) {
            // 単数選択モード: 出せるなら即プレイ
            if (this.game.canPlay(targetCard)) {
                this.handlePlay([index]);
            }
            return;
        }

        // 複数選択モード: 選択状態をトグル
        const idx = this.selectedIndices.indexOf(index);
        if (idx > -1) {
            this.selectedIndices.splice(idx, 1);
        } else {
            // 既に選択されているものがあれば、同じ数字かチェック
            if (this.selectedIndices.length > 0) {
                const firstCard = player.hand[this.selectedIndices[0]];
                if (firstCard.rank !== targetCard.rank) {
                    this.selectedIndices = [index]; // 違う数字なら選択を差し替え
                } else {
                    this.selectedIndices.push(index);
                }
            } else {
                this.selectedIndices.push(index);
            }
        }
        this.renderAll();
    }

    /**
     * 場札と山札の描画
     */
    renderTable() {
        this.elements.stockCount.textContent = this.game.stock.length;

        if (this.game.topCard) {
            this.elements.discardPile.innerHTML = '';
            const topCardEl = document.createElement('div');
            topCardEl.className = `card ${this.getCardColor(this.game.topCard.suit)}`;
            topCardEl.innerHTML = `<span>${this.game.topCard.displayName}</span>`;
            this.elements.discardPile.appendChild(topCardEl);
        }
    }

    /**
     * 操作ボタンの状態更新 (PlayRoute 準拠)
     */
    updateControls() {
        const isUserTurn = this.game.currentPlayerIndex === 0;
        const player = this.game.players[0];
        const playables = player.hand.filter(c => this.game.canPlay(c));

        // 初期表示を非表示に
        this.elements.btnDraw.classList.add('hidden');
        this.elements.btnPass.classList.add('hidden');

        if (isUserTurn) {
            if (this.selectedIndices.length > 0) {
                // 複数選択中: PLAYボタンを表示（PASSボタンを再利用せず、専用の挙動へ）
                const firstCard = player.hand[this.selectedIndices[0]];
                if (this.game.canPlay(firstCard)) {
                    this.elements.btnPass.textContent = "PLAY";
                    this.elements.btnPass.classList.remove('hidden');
                    this.elements.btnPass.disabled = false;
                    this.elements.btnPass.onclick = () => this.handlePlay(this.selectedIndices);
                }
            } else if (playables.length === 0) {
                // 出せるカードがない場合のみ DRAW/PASS を表示 (PlayRoute)
                if (!this.game.drawFlag) {
                    this.elements.btnDraw.classList.remove('hidden');
                    this.elements.btnDraw.disabled = false;
                } else {
                    this.elements.btnPass.textContent = "PASS";
                    this.elements.btnPass.classList.remove('hidden');
                    this.elements.btnPass.disabled = false;
                    this.elements.btnPass.onclick = () => this.handlePass();
                }
            }
        }

        // ドボンボタン
        const canDbon = this.game.checkDbn(this.game.currentPlayerIndex).some(p => p.id === 0);
        if (canDbon) {
            this.elements.btnDbon.classList.remove('hidden');
        } else {
            this.elements.btnDbon.classList.add('hidden');
        }
    }

    getCardColor(suit) {
        return (suit === 'heart' || suit === 'diamond') ? 'red' : 'black';
    }

    /**
     * メッセージ表示
     */
    showAnnouncement(text) {
        this.elements.announcement.textContent = text;
        this.elements.announcement.classList.remove('hidden');
        // CSSアニメーション(fadeInOut)が終わる頃に隠す
        setTimeout(() => {
            this.elements.announcement.classList.add('hidden');
        }, 2000);
    }

    /* --- Event Handlers --- */

    handlePlay(indices) {
        if (this.game.currentPlayerIndex !== 0) return;
        this.game.playCard(indices);
        this.selectedIndices = [];
        this.renderAll();
        this.processGameLoop();
    }

    handleDraw() {
        if (this.game.currentPlayerIndex !== 0) return;
        this.game.drawCard();
        this.renderAll();
    }

    handlePass() {
        if (this.game.currentPlayerIndex !== 0) return;
        this.game.pass();
        this.renderAll();
        this.processGameLoop();
    }

    handleDbon() {
        // 簡易実装
        this.showAnnouncement("DOBON!");
        this.game.isGameOver = true;
        this.renderAll();
    }

    /**
     * CPU操作を含むゲームの進行ループ（簡易版）
     */
    async processGameLoop() {
        if (this.game.isGameOver) return;

        while (this.game.players[this.game.currentPlayerIndex].isCpu && !this.game.isGameOver) {
            // CPUの思考時間演出
            await new Promise(resolve => setTimeout(resolve, 1500));
            this.game.processCpuTurn();
            this.renderAll();

            if (this.game.isGameOver) {
                this.showAnnouncement(`${this.game.players[this.game.currentPlayerIndex].name} WINS!`);
                break;
            }
        }
    }
}

// 起動
new GameRenderer();
