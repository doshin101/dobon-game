```javascript
import { DobonGame } from './src/logic/game.js';

// Phase 2 動作検証用：数ターン進行させる
const game = new DobonGame();
game.initGame();

// Phase 3 動作検証用：ドボンが発生するまで回す
let turnCount = 0;
while (!game.isGameOver && turnCount < 100) {
  const player = game.players[game.currentPlayerIndex];
  if (player.isCpu) {
    game.processCpuTurn();
  } else {
    // YOUも簡易自動プレイ
    const playableIndex = player.hand.findIndex(c => game.canPlay(c));
    if (playableIndex !== -1) {
      game.playCard(playableIndex);
    } else {
      game.drawCard();
      if (game.canPlay(player.hand[player.hand.length - 1])) {
        game.playCard(player.hand.length - 1);
      } else {
        game.pass();
      }
    }
  }
  turnCount++;
}

console.log(`\n-- - Game End after ${ turnCount } turns-- - `);
game.logGameState();
if (game.isGameOver) {
  console.log('Result: A Dobon occurred!');
} else {
  console.log('Result: Game ended without Dobon (limit reached).');
}
```
