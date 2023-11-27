export class MiroApp {
  static init() {
    miro.board.ui.on("icon:click", async () => {
      await miro.board.ui.openPanel({ url: "/" });
    });
  }
}
