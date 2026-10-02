import { Scene } from "./scene";
import { GameClient } from "@/client";
import type { SceneManager } from "./scene-manager";

export class GameScene extends Scene {
  private gameClient: GameClient;
  private serverUrl: string;

  constructor(canvas: HTMLCanvasElement, sceneManager?: SceneManager) {
    super(canvas);

    // Get server URL from environment
    // Default to the local dev server if no explicit URL is provided
    const isBrowser = typeof window !== "undefined";
    const host = isBrowser ? window.location.hostname || "localhost" : "localhost";
    const protocol = isBrowser && window.location.protocol === "https:" ? "wss" : "ws";
    const defaultServerUrl = `${protocol}://${host}:3001`;
    // A host page (e.g. the LAN build) can override the server URL at runtime
    const runtimeServerUrl = isBrowser ? (window as any).__GAME_SERVER_URL__ : undefined;
    this.serverUrl =
      (typeof runtimeServerUrl === "string" && runtimeServerUrl.trim()) ||
      import.meta.env.VITE_WSS_URL?.trim() ||
      defaultServerUrl;

    // Get loaded asset and sound managers from scene manager
    const assetManager = sceneManager?.getAssetManager();
    const soundManager = sceneManager?.getSoundManager();

    if (!assetManager || !soundManager) {
      throw new Error("Assets not loaded! Make sure to go through LoadingScene first.");
    }

    // Create game client with pre-loaded managers
    this.gameClient = new GameClient(canvas, assetManager, soundManager);
  }

  async init(): Promise<void> {
    // Connect to server
    await this.gameClient.connectToServer(this.serverUrl);

    // Start the game
    this.gameClient.start();

    // Start background music
    this.gameClient.getSoundManager().playBackgroundMusic();
  }

  update(_deltaTime: number): void {
    // GameClient handles its own update loop
    // This scene's update is not used since GameClient manages its own RAF loop
  }

  render(): void {
    // GameClient handles its own rendering
    // This scene's render is not used since GameClient manages its own RAF loop
  }

  cleanup(): void {
    // Cleanup game client
    this.gameClient.unmount();
  }

  /**
   * Get the game client instance (for React integration)
   */
  public getGameClient(): GameClient {
    return this.gameClient;
  }
}
