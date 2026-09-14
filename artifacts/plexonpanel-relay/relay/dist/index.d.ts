import coreWorker, { PairingDirectory, ServerRoom as CoreServerRoom, currentAccess, filterEvent, validDevice } from "./index-core.js";
export { PairingDirectory, currentAccess, filterEvent, validDevice };
export declare class ServerRoom extends CoreServerRoom {
}
declare const worker: {
    fetch(request: Request, env: Parameters<typeof coreWorker.fetch>[1]): Promise<Response>;
};
export default worker;
