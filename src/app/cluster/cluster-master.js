"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const config_1 = __importDefault(require("../../config/config"));
const os_1 = require("os");
const __1 = __importDefault(require(".."));
const fork_tracker_1 = require("./fork-tracker");
/**
 * @todo Add a handler for when the incoming message from the child process is a string
 * @todo Return messages through event emitter
 */
class ClusterMaster {
    constructor(cluster, forkTasker) {
        this.cluster = cluster;
        this.forkTasker = forkTasker;
        // Set up a listener for dead workers.  If a worker has died,
        // call createFork to evaluate whether a new worker should be spawned
        __1.default.jobStatusNotifier.on('worker-exit', () => {
            this.createFork();
        });
    }
    /**
     * Initiates forking the cluster.  It also adds listeners to jobStatusNotifier
     * that will handle any dying workers or unfinished jobs.
     */
    initiateForking() {
        let numForks;
        // If this is the master,
        if (this.cluster.isMaster) {
            // check if the config file contains a valid number of forks to create
            if (config_1.default.totalForks && config_1.default.totalForks > 0) {
                numForks = config_1.default.totalForks;
            }
            else {
                // if the config doesn't have a valid number in totalForks, create as
                // many forks as we have cpus
                numForks = os_1.cpus.length;
            }
            for (let i = 0, j = numForks; i < j; ++i) {
                this.createFork();
            }
            ClusterMaster.forksCreated = true;
        }
        else {
            this.forkTasker.listenToWorker();
        }
    }
    /**
     * Creates forks if the app is not awaiting death.  Asks forkTasker to
     * start tracking them.
     */
    createFork() {
        if (!__1.default.appIsAwaitingDeath) {
            const newWorker = this.cluster.fork();
            fork_tracker_1.ForkTracker.beginTrackingWorker(newWorker);
        }
        else {
            if (Object.keys(this.cluster.workers).length === 0 && __1.default.appIsAwaitingDeath) {
                __1.default.deathMonitor.emit('ready-to-die');
            }
        }
    }
}
exports.ClusterMaster = ClusterMaster;
/**
 *   Notifies the controller of any errors or responses received from the tasks run
 * This allows the parent to go on about its business after sending down a job without having
 * to wait on the app to finish, whether synchronously or asynchronously
 */
ClusterMaster.errorAndResponseNotifier = new events_1.EventEmitter();
/**
 *  This static boolean value makes sure that, globally, the forking process only
 *  occurs once in the lifespan of the application
 */
ClusterMaster.forksCreated = false;
//# sourceMappingURL=cluster-master.js.map