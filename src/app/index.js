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
 * A class through which new jobs can be requested.  Once a Job Requestor has found a Job Acceptor,
 * this class's initiateJobRequest function can be called to initiate that job.
 *
 * Additionally, if this class's deathMonitor event emitter is triggered to emit a "die" event, this class will
 * begin cleaning up all unfinished tasks, and stop accepting new ones.  The event "undie" can also be emitted, which will
 * cause the class to resume operation, but it shouldn't be used.  Once "die" is emitted, this node process should be killed and restarted altogether.
 *
 * This is designed to only have one instance running at a time.  In fact, deathMonitor is a static resource.  If multiple instances of this class are created,
 * they will all kill themselves when "die" is emitted from deathMontior.
 */
class TCPJobInitiator {
    constructor() {
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
    /**
     * This method is used to initiate a task in a child process.  It will automatically find the least busy child process and assign the job to them.
     * @param identifier An IChannelIdentifier containing the port/host information for the target job acceptor
     * @param task The name of the task to be requested
     */
    initiateJobRequest(identifier, task) {
        this.clusterForker.initiateJobRequest(identifier, task);
    }
}
exports.default = TCPJobInitiator;
/**
 * This event emitter will be used to let the app know it needs to die.
 * I could add that functionality into the errorAndResponseNotifier event emitter.
 * But that is messy.  They have different jobs, they should be different emitters.
 *
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