import './style.css';

import { ApiClient } from './api/client';
import { AppStore } from './state/appStore';
import { CharacterCreationView } from './views/CharacterCreationView';
import { GameView } from './views/GameView';
import { LoginView } from './views/LoginView';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing root element');
}

const apiClient = new ApiClient();
const store = new AppStore(apiClient);
const loginView = new LoginView({
  onLogin: (email, password) => store.login(email, password),
  onRegister: (email, password) => store.register(email, password)
});

const characterView = new CharacterCreationView({
  onCreate: (name) => store.createCharacter(name),
  onLogout: () => store.logout()
});

const gameView = new GameView(apiClient, store);

let activeView: 'loading' | 'login' | 'character' | 'game' = 'loading';

store.subscribe((state) => {
  switch (state.view) {
    case 'loading':
      if (activeView !== 'loading') {
        root.innerHTML = '<div class="loader">Connexion...</div>';
        activeView = 'loading';
      }
      break;
    case 'login':
      gameView.destroy();
      loginView.render(root);
      activeView = 'login';
      break;
    case 'character-creation':
      gameView.destroy();
      characterView.render(root);
      activeView = 'character';
      break;
    case 'game':
      if (state.token && state.gameState) {
        gameView.mount(root, state.token, state.gameState);
        activeView = 'game';
      }
      break;
  }

  if (state.view === 'game' && state.gameState) {
    gameView.update(state.gameState);
  }
});

store.bootstrap();
