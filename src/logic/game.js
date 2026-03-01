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
        this.multiplier = 1;   // セットの倍率
        this.doubleReachFlags = new Set(); // ダブルリーチを宣言したプレイヤーID
        this.reachFlags = new Set();       // リーチを宣言したプレイヤーID
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
    async startSet() {
        console.log(`--- Set ${this.setCount} Start ---`);
        this.multiplier = 1;
        this.doubleReachFlags.clear();
        this.reachFlags.clear();

        this.createDeck();
        this.shuffleDeck();
        this.dealCards();

        await this.startCheck(); // Phase 1: CheckStart相当 (B00)
    }

    /**
     * ターン開始前のチェック (B00)
     */
    async startCheck() {
        console.log('--- Start Check (B00) ---');

        // 全プレイヤーの手札合計値をチェック (B01)
        const atMost13Players = this.players.filter(p => {
            const sum = p.hand.reduce((s, c) => s + c.value, 0);
            return sum <= 13;
        });

        // 場札をセット (B02)
        this.setInitialTopCard();

        // 初ドボン（ショドボン）チェック (B09)
        const winners = this.checkDbn(-1); // 誰も出してないので-1
        if (winners.length > 0) {
            this.resolveFirstDbn(winners);
        } else {
            // ターン開始準備 (B08)
            this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
            this.logGameState();
        }
    }

    /**
     * 初ドボン（ショドボン）の決着 (B12-B17)
     */
    resolveFirstDbn(winners) {
        console.log(`!!! FIRST DOBON (SHODOBON) !!!`);
        // 本来はここで詳細な報酬計算 (Reward) へ
        this.isGameOver = true;
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
     * @param {number[]} cardIndices - 出すカードのインデックス配列（複数枚出し対応）
     */
    playCard(cardIndices) {
        if (!Array.isArray(cardIndices)) cardIndices = [cardIndices];
        const player = this.players[this.currentPlayerIndex];

        // 複数枚出しの妥当性チェック (checkHandSet相当)
        if (cardIndices.length > 1) {
            const ranks = cardIndices.map(i => player.hand[i].rank);
            if (!ranks.every(r => r === ranks[0])) {
                console.log("Invalid multiple play: Ranks must match.");
                return;
            }
        }

        // カードを移動
        const playedCards = [];
        // インデックスがずれないよう、降順で削除
        cardIndices.sort((a, b) => b - a).forEach(index => {
            playedCards.push(player.hand.splice(index, 1)[0]);
        });

        const lastCard = playedCards[0]; // 最後に重なるカード
        this.topCard = lastCard;
        this.discardPile.push(...playedCards);
        console.log(`${player.name} played ${playedCards.map(c => c.displayName).join(', ')}.`);

        // リーチ宣言のチェック (I03)
        this.checkReach(player);

        // Phase 3: ドボン判定 (J10)
        const winners = this.checkDbn(player.id);
        if (winners.length > 0) {
            this.resolveDbn(winners, player.id);
        } else {
            this.endTurn();
        }
    }

    /**
     * リーチ宣言のチェック (I03)
     */
    checkReach(player) {
        const sum = player.hand.reduce((s, c) => s + c.value, 0);
        if (sum <= 13) {
            this.reachFlags.add(player.id);
            console.log(`${player.name} declared Reach!`);
        } else {
            // 合計が13を超えたらリーチ解除 (Release)
            this.reachFlags.delete(player.id);
        }
    }

    /**
     * ドボン判定 (J10)
     * @param {number} actorId - カードを出したプレイヤーのID (-1は初回場札)
     * @returns {Object[]} 勝利プレイヤーリスト
     */
    checkDbn(actorId) {
        const winners = [];
        const targetValue = this.topCard.value;

        this.players.forEach(p => {
            // ドボン返し (K05): 出した本人も手札合計が一致すればドボン返し可能
            const isActor = (p.id === actorId);
            const handSum = p.hand.reduce((sum, c) => sum + c.value, 0);

            if (handSum === targetValue) {
                winners.push({
                    player: p,
                    isCounter: isActor,
                    multiplier: this.calculateMultiplier(p)
                });
            }
        });
        return winners;
    }

    /**
     * プレイヤーの現在の倍率を計算 (L03, B19等)
     */
    calculateMultiplier(player) {
        let m = this.multiplier;
        if (this.doubleReachFlags.has(player.id)) m *= 2;
        if (this.reachFlags.has(player.id)) m *= 1;
        return m;
    }

    /**
     * ドボン成立時の処理 (K13/Reward相当)
     */
    resolveDbn(winnerObjects, loserId) {
        console.log(`!!! DOBON RESOLVED !!!`);
        const basePoints = 1000; // 基本点 (MVP用)
        const loser = loserId !== -1 ? this.players[loserId] : null;

        winnerObjects.forEach(w => {
            const winner = w.player;
            const points = basePoints * w.multiplier;
            console.log(`Winner: ${winner.name} (Multiplier: x${w.multiplier}, Points: ${points})`);

            // ポイント移動 (B18 / Reward)
            this.transferPoints(winner.id, loserId, points);
        });

        this.isGameOver = true;
    }

    /**
     * ポイントの移動 (B18 / TransferPoints)
     */
    transferPoints(winnerId, loserId, points) {
        const winner = this.players[winnerId];
        winner.points += points;

        if (loserId !== -1) {
            const loser = this.players[loserId];
            loser.points -= points;
            if (loser.points < 0) loser.points = 0;
        }
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
