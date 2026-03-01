import { DobonGame } from '../logic/game.js';

/**
 * ゲームUIの描画と操作を管理するクラス
 */
class GameRenderer {
    constructor() {
        this.game = new DobonGame();
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
        this.showAnnouncement(`SET ${this.game.setCount} START`);

        // YOUのターンでなければCPUを動かす
        if (this.game.players[this.game.currentPlayerIndex].isCpu) {
            this.processGameLoop();
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

            slot.querySelector('.points').textContent = `${p.points}pts`;

            // 手札枚数の表示
            if (p.isCpu) {
                const handMini = slot.querySelector('.hand-mini');
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
            cardEl.addEventListener('click', () => this.handlePlay(index));
            this.elements.userHand.appendChild(cardEl);
        });
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
     * 操作ボタンの状態更新
     */
    updateControls() {
        const isUserTurn = this.game.currentPlayerIndex === 0;
        const playables = this.game.players[0].hand.filter(c => this.game.canPlay(c));

        // ドロー、パス、ドボンの各ボタン制御（ロジックとの整合性は要調整）
        this.elements.btnDraw.disabled = !isUserTurn || this.game.drawFlag;
        this.elements.btnPass.disabled = !isUserTurn || !this.game.drawFlag;

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

    handlePlay(index) {
        if (this.game.currentPlayerIndex !== 0) return;
        const card = this.game.players[0].hand[index];
        if (!this.game.canPlay(card)) return;

        this.game.playCard(index);
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
