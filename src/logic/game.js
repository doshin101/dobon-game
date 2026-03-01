import { Card } from './card.js';

/**
 * ドボンのゲームロジックを管理するクラス
 */
export class DobonGame {
    constructor() {
        this.players = [
            { id: 0, name: 'YOU', hand: [], points: 6000, isCpu: false },
            { id: 1, name: 'CPU 1', hand: [], points: 6000, isCpu: true },
            { id: 2, name: 'CPU 2', hand: [], points: 6000, isCpu: true },
            { id: 3, name: 'CPU 3', hand: [], points: 6000, isCpu: true }
        ];
        this.stock = [];      // 山札
        this.discardPile = []; // 捨札
        this.topCard = null;   // 場札
        this.dealerIndex = 0;  // 親のインデックス
        this.currentPlayerIndex = 0; // 現在のターンプレイヤー
        this.setCount = 1;     // セット数
        this.isGameOver = false;
        this.drawFlag = false; // そのターンにドローしたか
    }

    /**
     * ゲームの初期化 (Phase 1: GameStart相当)
     */
    initGame() {
        console.log('--- Game Start ---');
        // MVPでは全員6000ptsで開始 (C02)
        this.players.forEach(p => p.points = 6000);
        // ランダムに親を決定 (C03)
        this.dealerIndex = Math.floor(Math.random() * this.players.length);
        console.log(`Dealer: ${this.players[this.dealerIndex].name}`);

        this.startSet();
    }

    /**
     * セットの開始 (Phase 1: SetStart相当)
     */
    startSet() {
        console.log(`--- Set ${this.setCount} Start ---`);
        this.createDeck();
        this.shuffleDeck();
        this.dealCards();
        this.setInitialTopCard(); // 最初の場札をセット
        this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length; // 親の次から開始

        this.logGameState();
    }

    /**
     * 最初の場札をセット (B02)
     */
    setInitialTopCard() {
        this.topCard = this.stock.pop();
        this.discardPile.push(this.topCard);
        console.log(`Initial Top Card: ${this.topCard.displayName}`);
    }

    /**
     * 次のプレイヤーへターンを回す
     */
    nextTurn() {
        this.drawFlag = false;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        console.log(`\n--- ${this.players[this.currentPlayerIndex].name}'s Turn ---`);
    }

    /**
     * 手札からカードを出せるか判定
     * @param {Card} card 
     * @returns {boolean}
     */
    canPlay(card) {
        if (!this.topCard) return true;
        return card.suit === this.topCard.suit || card.rank === this.topCard.rank;
    }

    /**
     * 山札から1枚引く (G01)
     */
    drawCard() {
        if (this.stock.length === 0) {
            this.reshuffleDiscardPile();
        }
        const card = this.stock.pop();
        const player = this.players[this.currentPlayerIndex];
        player.hand.push(card);
        this.drawFlag = true;
        console.log(`${player.name} drew a card. (Stock: ${this.stock.length})`);
        return card;
    }

    /**
     * 捨札をリシャッフルして山札に戻す (G05)
     */
    reshuffleDiscardPile() {
        console.log('Reshuffling discard pile...');
        const top = this.discardPile.pop(); // 現在の場札は残す
        this.stock = [...this.discardPile];
        this.discardPile = [top];
        this.shuffleDeck();
    }

    /**
     * カードを出す (J09)
     * @param {number} cardIndex 
     */
    playCard(cardIndex) {
        const player = this.players[this.currentPlayerIndex];
        const card = player.hand.splice(cardIndex, 1)[0];
        this.topCard = card;
        this.discardPile.push(card);
        console.log(`${player.name} played ${card.displayName}.`);

        // Phase 3: ドボン判定 (J10)
        const winners = this.checkDbn(player.id);
        if (winners.length > 0) {
            this.resolveDbn(winners, player.id);
        } else {
            this.endTurn();
        }
    }

    /**
     * ドボン判定 (J10)
     * カードを出したプレイヤー以外の手札合計をチェック
     * @param {number} actorId - カードを出したプレイヤーのID
     * @returns {Object[]} 勝利プレイヤーリスト
     */
    checkDbn(actorId) {
        const winners = [];
        this.players.forEach(p => {
            if (p.id === actorId) return; // 出した本人は除外

            const handSum = p.hand.reduce((sum, c) => sum + c.value, 0);
            if (handSum === this.topCard.value) {
                winners.push(p);
            }
        });
        return winners;
    }

    /**
     * ドボン成立時の処理 (K13/Reward相当)
     * @param {Object[]} winners 
     * @param {number} loserId 
     */
    resolveDbn(winners, loserId) {
        const loser = this.players[loserId];
        const winnerNames = winners.map(w => w.name).join(', ');
        console.log(`!!! DOBON !!! Winner(s): ${winnerNames}, Loser: ${loser.name}`);

        // MVP: シンプルな勝利確定
        this.isGameOver = true;

        // 将来的にはここでポイント移動 (Reward) を行う
        // 現在はとりあえずコンソール表示のみ
    }

    /**
     * パスする (I01)
     */
    pass() {
        const player = this.players[this.currentPlayerIndex];
        console.log(`${player.name} passed.`);
        this.endTurn();
    }

    /**
     * ターン終了処理
     */
    endTurn() {
        const player = this.players[this.currentPlayerIndex];

        // MVP: 手札が1枚なら強制ドロー (F02/G01相当)
        if (player.hand.length === 1 && !this.drawFlag) {
            console.log(`${player.name} has only 1 card. Forced draw.`);
            this.drawCard();
        }

        if (player.hand.length === 0) {
            console.log(`${player.name} wins! (Hand empty - tentative)`);
            this.isGameOver = true;
            return;
        }

        this.nextTurn();
    }

    /**
     * CPUのターン実行
     */
    processCpuTurn() {
        const player = this.players[this.currentPlayerIndex];
        if (!player.isCpu) return;

        // 出せるカードを探す
        const playableIndices = player.hand
            .map((card, index) => this.canPlay(card) ? index : -1)
            .filter(index => index !== -1);

        if (playableIndices.length > 0) {
            // 出せるカードがあればランダムに選択 (J08)
            const randomIndex = playableIndices[Math.floor(Math.random() * playableIndices.length)];
            this.playCard(randomIndex);
        } else {
            // 出せなければドロー (J07/G01)
            this.drawCard();
            // ドロー後にもう一度判定
            if (this.canPlay(player.hand[player.hand.length - 1])) {
                this.playCard(player.hand.length - 1);
            } else {
                this.pass();
            }
        }
    }

    /**
     * 52枚のトランプを作成
     */
    createDeck() {
        const suits = ['spade', 'heart', 'diamond', 'club'];
        this.stock = [];
        for (const suit of suits) {
            for (let rank = 1; rank <= 13; rank++) {
                this.stock.push(new Card(suit, rank));
            }
        }
    }

    /**
     * 山札をシャッフル (フィッシャー・イェーツ)
     */
    shuffleDeck() {
        for (let i = this.stock.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.stock[i], this.stock[j]] = [this.stock[j], this.stock[i]];
        }
    }

    /**
     * 手札を3枚ずつ配布 (A04)
     */
    dealCards() {
        // 全プレイヤーの手札をリセット
        this.players.forEach(p => p.hand = []);

        // 3回ずつ、各プレイヤーに1枚ずつ配る
        for (let round = 0; round < 3; round++) {
            for (let i = 0; i < this.players.length; i++) {
                // 親の次から配るのが一般的だが、簡略化のため0から開始
                const card = this.stock.pop();
                this.players[i].hand.push(card);
            }
        }
    }

    /**
     * デバッグ用：現在の状態をコンソールに出力
     */
    logGameState() {
        console.log('Stock count:', this.stock.length);
        this.players.forEach(p => {
            const handStr = p.hand.map(c => c.displayName).join(', ');
            const handSum = p.hand.reduce((sum, c) => sum + c.value, 0);
            console.log(`${p.name} Hand: [${handStr}] (Sum: ${handSum})`);
        });
    }
}
