import Achex from "./Achex.js";
import Terminal from "./Terminal.js";

export class WS {
  constructor() { }
  connectPromise = Promise.resolve();
  initialize = async () => {
    this.achex = new Achex();
    this.connectPromise = this.connect();
    this.achex.addEventListener("my-message", this.receiveAchexHandler, { passive: true, });
    this.achex.addEventListener("my-error", async ({ detail, }) => { if (detail === "socket is not connected") { this.connectPromise = this.connect(); } });

    this.terminal = new Terminal();
    await this.terminal.initialize();
    this.terminal.sendHandler = this.toH;

    await this.connectPromise;
    return this;
  };
  connect = async () => {
    const authPromise = new Promise(r => this.achex.addEventListener("my-auth", r, { passive: true, once: true, }));
    this.achex.connect();
    await authPromise;
    const joinHubPromise = new Promise(r => this.achex.addEventListener("my-joinHub", r, { passive: true, once: true, }));
    this.achex.joinHub();
    await joinHubPromise;
  };
  toH = async data => {
    await this.connectPromise;
    return this.achex.toH(data);
  };
  receiveAchexHandler = async ({ detail }) => {
    const data = this.achex.parseMessage(...detail)?.message;
    console.log("MyWS, receiveAchexHandler\n", data, "\nMyWS, receiveAchexHandler");
    if (data) { await this.terminal.receive(data); }
    return true;
  };
}
export default WS;
