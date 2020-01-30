"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cluster_1 = __importDefault(require("cluster"));
const fork_tasker_1 = require("./cluster/fork-tasker");
const events_1 = require("events");
const cluster_master_1 = require("./cluster/cluster-master");
/**
 * Tcpjob initiator
 * @todo Have the application remove all listeners on a child process on finishing a job, and
 * re-add them when the child process is triggered again.  Make sure that it checks to see if the
 * listeners already exist, in case the child process is running multiple jobs so that it doesn't add
 * duplicate listeners
 * @todo Actually add some proper documentation to this code
 */
class TCPJobInitiator {
    constructor() {
        /**
         * When this value is true, the app will stop accepting new jobs.
         */
        this.clusterAsCluster = cluster_1.default;
        this.clusterForker = new fork_tasker_1.ForkTasker(this.clusterAsCluster);
        this.clusterMaster = new cluster_master_1.ClusterMaster(this.clusterAsCluster, this.clusterForker);
        // Check if there are listeners subscribed to the die and undie events for the death monitor.
        // If there aren't, add them.
        const dieDeathMonitorListeners = TCPJobInitiator.deathMonitor.listeners('die');
        const undieDeathMonitorListeners = TCPJobInitiator.deathMonitor.listeners('undie');
        if (!dieDeathMonitorListeners.length) {
            TCPJobInitiator.deathMonitor.on('die', () => (TCPJobInitiator._appIsAwaitingDeath = true));
        }
        if (!undieDeathMonitorListeners.length) {
            TCPJobInitiator.deathMonitor.on('undie', () => (TCPJobInitiator._appIsAwaitingDeath = false));
        }
        // If workers haven't been spawned, spawn the workers
        if (!cluster_master_1.ClusterMaster.forksCreated) {
            this.clusterMaster.initiateForking();
        }
    }
    /**
     * When this value is true, the app will stop accepting new jobs.
     * This value should not be changed directly.  Actually, I'm gonna make it a
     * getter so that it specifically can't be changed directly.  Instead, it should be changed
     * by emitting a 'die' event from the 'deathMonitor' event emitter
     */
    static get appIsAwaitingDeath() {
        return this._appIsAwaitingDeath;
    }
    initiateJobRequest(identifier, task) {
        this.clusterForker.initiateJobRequest(identifier, task);
    }
}
exports.default = TCPJobInitiator;
/**
 *   This event emitter will be used to let the app know it needs to die.
 * I could add that functionality into the errorAndResponseNotifier event emitter.
 * But that is messy.  They have different jobs, they should be different emitters.
 * The only two listeners for deathMonitor are 'die', which instructs the app to begin prepping for death,
 * or 'undie', which instructs the app to resume business as usual.  I can't see any reason why
 * we'd ever want to 'undie' the app, rather than just letting it die and rebooting it.  But you never know.
 */
TCPJobInitiator.deathMonitor = new events_1.EventEmitter();
/**
 * @inheritDoc
 */
TCPJobInitiator.jobStatusNotifier = new events_1.EventEmitter();
TCPJobInitiator._appIsAwaitingDeath = false;
//# sourceMappingURL=index.js.map