import coreWorker, { PairingDirectory, ServerRoom as CoreServerRoom, currentAccess, filterEvent, validDevice } from "./index-core.js";
import { type RelayBuildEnvironment } from "./build-identity.js";
export { PairingDirectory, currentAccess, filterEvent, validDevice };
export declare class ServerRoom extends CoreServerRoom {
}
type WorkerEnv = Parameters<typeof coreWorker.fetch>[1] & RelayBuildEnvironment;
declare const worker: {
    fetch(request: Request, env: WorkerEnv): Promise<Response>;
};
export default worker;
