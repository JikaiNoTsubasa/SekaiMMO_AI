// Chat Panel - Interface de chat avec onglets
// SekaiMMO v2.0

export type ChatChannel = 'local' | 'guild' | 'whisper';

export interface ChatMessage {
  id: number;
  channel: ChatChannel;
  senderName: string;
  senderId: number;
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

export interface ChatPanelConfig {
  container: HTMLElement;
  onSendMessage?: (channel: ChatChannel, content: string, targetName?: string) => void;
  onWhisperClick?: (playerName: string) => void;
  maxMessages?: number;
}

export class ChatPanel {
  private container: HTMLElement;
  private element: HTMLElement;
  private config: ChatPanelConfig;
  private isVisible: boolean = true;
  private isMinimized: boolean = false;

  private currentChannel: ChatChannel = 'local';
  private messages: Map<ChatChannel, ChatMessage[]> = new Map();
  private whisperTarget: string | null = null;
  private maxMessages: number;

  constructor(config: ChatPanelConfig) {
    this.config = config;
    this.container = config.container;
    this.maxMessages = config.maxMessages ?? 100;
    this.element = this.createElement();
    this.initializeChannels();
    this.container.appendChild(this.element);
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'chat-panel';
    panel.innerHTML = `
      <div class="chat-header">
        <div class="chat-tabs">
          <button class="chat-tab active" data-channel="local">Local</button>
          <button class="chat-tab" data-channel="guild">Guilde</button>
          <button class="chat-tab" data-channel="whisper">MP</button>
        </div>
        <div class="chat-controls">
          <button class="chat-minimize" aria-label="Minimiser">−</button>
        </div>
      </div>
      <div class="chat-body">
        <div class="chat-messages"></div>
        <div class="chat-input-area">
          <div class="whisper-target"></div>
          <input type="text" class="chat-input" placeholder="Appuyez sur Entrée pour parler..." maxlength="500">
          <button class="chat-send">Envoyer</button>
        </div>
      </div>
    `;

    // Tab buttons
    const tabBtns = panel.querySelectorAll<HTMLButtonElement>('.chat-tab');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const channel = btn.dataset.channel as ChatChannel;
        this.switchChannel(channel);
      });
    });

    // Minimize button
    const minimizeBtn = panel.querySelector('.chat-minimize')!;
    minimizeBtn.addEventListener('click', () => this.toggleMinimize());

    // Input
    const input = panel.querySelector<HTMLInputElement>('.chat-input')!;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send button
    const sendBtn = panel.querySelector('.chat-send')!;
    sendBtn.addEventListener('click', () => this.sendMessage());

    return panel;
  }

  private initializeChannels(): void {
    this.messages.set('local', []);
    this.messages.set('guild', []);
    this.messages.set('whisper', []);
  }

  private switchChannel(channel: ChatChannel): void {
    this.currentChannel = channel;

    // Update tab buttons
    const tabBtns = this.element.querySelectorAll('.chat-tab');
    tabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-channel') === channel);
      btn.classList.remove('has-new');
    });

    // Update whisper target visibility
    const whisperTarget = this.element.querySelector<HTMLElement>('.whisper-target')!;
    if (channel === 'whisper' && this.whisperTarget) {
      whisperTarget.textContent = `À: ${this.whisperTarget}`;
      whisperTarget.style.display = 'block';
    } else {
      whisperTarget.style.display = 'none';
    }

    // Update placeholder
    const input = this.element.querySelector<HTMLInputElement>('.chat-input')!;
    const placeholders: Record<ChatChannel, string> = {
      local: 'Parler au chat local...',
      guild: 'Parler au chat de guilde...',
      whisper: this.whisperTarget ? `Message à ${this.whisperTarget}...` : '/w pseudo message',
    };
    input.placeholder = placeholders[channel];

    this.renderMessages();
  }

  private renderMessages(): void {
    const messagesContainer = this.element.querySelector('.chat-messages')!;
    const channelMessages = this.messages.get(this.currentChannel) ?? [];

    messagesContainer.innerHTML = '';

    channelMessages.forEach((msg) => {
      const msgEl = document.createElement('div');
      msgEl.className = `chat-message ${msg.isSystem ? 'system' : ''} channel-${msg.channel}`;

      const time = msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      if (msg.isSystem) {
        msgEl.innerHTML = `
          <span class="msg-time">[${time}]</span>
          <span class="msg-content system">${this.escapeHtml(msg.content)}</span>
        `;
      } else {
        msgEl.innerHTML = `
          <span class="msg-time">[${time}]</span>
          <span class="msg-sender" data-player-id="${msg.senderId}">${this.escapeHtml(msg.senderName)}</span>
          <span class="msg-separator">:</span>
          <span class="msg-content">${this.escapeHtml(msg.content)}</span>
        `;

        // Click on sender name to whisper
        const senderEl = msgEl.querySelector('.msg-sender')!;
        senderEl.addEventListener('click', () => {
          this.setWhisperTarget(msg.senderName);
        });
      }

      messagesContainer.appendChild(msgEl);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private sendMessage(): void {
    const input = this.element.querySelector<HTMLInputElement>('.chat-input')!;
    let content = input.value.trim();

    if (!content) return;

    // Check for whisper command
    if (content.startsWith('/w ') || content.startsWith('/whisper ')) {
      const parts = content.split(' ');
      parts.shift(); // Remove /w or /whisper
      const targetName = parts.shift();
      if (targetName) {
        this.setWhisperTarget(targetName);
        content = parts.join(' ');
        if (!content) {
          input.value = '';
          return;
        }
      }
    }

    // Send message
    if (this.currentChannel === 'whisper' && !this.whisperTarget) {
      this.addSystemMessage('Spécifiez un destinataire avec /w pseudo message');
      return;
    }

    this.config.onSendMessage?.(
      this.currentChannel,
      content,
      this.currentChannel === 'whisper' ? this.whisperTarget ?? undefined : undefined
    );

    input.value = '';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    this.element.classList.toggle('minimized', this.isMinimized);

    const minimizeBtn = this.element.querySelector('.chat-minimize')!;
    minimizeBtn.textContent = this.isMinimized ? '+' : '−';
  }

  /**
   * Ajoute un message au chat
   */
  addMessage(message: ChatMessage): void {
    const channelMessages = this.messages.get(message.channel);
    if (!channelMessages) return;

    channelMessages.push(message);

    // Limit messages
    if (channelMessages.length > this.maxMessages) {
      channelMessages.shift();
    }

    // Notify if not current channel
    if (message.channel !== this.currentChannel && !message.isSystem) {
      const tabBtn = this.element.querySelector(`.chat-tab[data-channel="${message.channel}"]`);
      tabBtn?.classList.add('has-new');
    }

    // Render if current channel
    if (message.channel === this.currentChannel) {
      this.renderMessages();
    }
  }

  /**
   * Ajoute un message système
   */
  addSystemMessage(content: string, channel?: ChatChannel): void {
    this.addMessage({
      id: Date.now(),
      channel: channel ?? this.currentChannel,
      senderName: 'Système',
      senderId: 0,
      content,
      timestamp: new Date(),
      isSystem: true,
    });
  }

  /**
   * Définit la cible du whisper
   */
  setWhisperTarget(playerName: string): void {
    this.whisperTarget = playerName;
    this.switchChannel('whisper');
  }

  /**
   * Efface la cible du whisper
   */
  clearWhisperTarget(): void {
    this.whisperTarget = null;
    const whisperTarget = this.element.querySelector<HTMLElement>('.whisper-target')!;
    whisperTarget.style.display = 'none';
  }

  /**
   * Focus sur l'input
   */
  focus(): void {
    const input = this.element.querySelector<HTMLInputElement>('.chat-input')!;
    input.focus();
  }

  /**
   * Affiche le panneau
   */
  show(): void {
    this.isVisible = true;
    this.element.classList.add('visible');
  }

  /**
   * Cache le panneau
   */
  hide(): void {
    this.isVisible = false;
    this.element.classList.remove('visible');
  }

  /**
   * Toggle la visibilité
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Récupère l'élément DOM
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Détruit le composant
   */
  destroy(): void {
    this.element.remove();
    this.messages.clear();
  }
}
