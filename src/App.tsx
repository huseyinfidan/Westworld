/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import GameCanvas from './components/GameCanvas';

export default function App() {
  return (
    <div id="game-root" className="w-screen h-screen">
      <GameCanvas />
    </div>
  );
}
