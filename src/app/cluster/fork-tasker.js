"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = __importDefault(require(".."));
const fork_tracker_1 = require("./fork-tracker");
const tcp_job_initiator_socket_1 = require("../tcp-job-initiator-socket");
const worker_callbacks_1 = require("./worker-callbacks");
/**
 * This helper class helps manage the forks and their jobs from the cluster master.
 * This class can't really survive on its own, and really does need to be paired with ClusterMaster.
 * It's a bit unfortunate, but I saw many drawbacks to writing it any other way.
 */
class ForkTasker {
    constructor(cluster) {
        this.cluster = cluster;
        this.jobStatusNotifier = __1.default.jobStatusNotifier;
        this.forkTracker = new fork_tracker_1.ForkTracker();
        cluster.on('message', (worker, message, handle) => {
            // messageCallback (which didn't end up being a call back after all) wil
            // return void if it was fed a string.  Strings have their own callbacks that are
            // handled separately
            const data = worker_callbacks_1.messageCallback(worker, message, handle);
            if (data) {
                // If it wasn't a string, then it was a task completion notification.
                // In that case, notify anyone listening on jobStatusNotifier that
                // the task is now complete, and pass them the data
                this.jobStatusNotifier.emit('task-complete', data);
            }
        });
        cluster.on('exit', (worker, code, signal) => {
            this.jobStatusNotifier.emit('worker-exit', { worker, code, signal });
            const unfinishedJobs = worker_callbacks_1.checkForUnfinishedJobs(worker);
            if (unfinishedJobs.length) {
                unfinishedJobs.forEach((job) => {
                    this.initiateJobRequest(job, job.task);
                });
            }
        });
    }
    /**
     * This is the function that will initiate a job within this module
     * @param identifier An identifier, received from the job-requestor
     * @param task The job to be done
     */
    initiateJobRequest(identifier, task) {
        const taskedIdentifier = { ...identifier, task };
        if (!__1.default.appIsAwaitingDeath) {
            const cpuLoadIndex = this.forkTracker.findMostAvailableJobTakerIndex();
            const fork = fork_tracker_1.ForkTracker.cpuLoadIndexToForkedCPU[cpuLoadIndex];
            const workerId = fork.id;
            const worker = this.cluster.workers[workerId];
            // Send the job data to a worker. At this point, all the listeners have been attached.
            worker.send(taskedIdentifier);
        }
        else {
            this.jobStatusNotifier.emit('unfinished-job', taskedIdentifier);
        }
    }
    /**
     * Instructs the worker to begin listening to messages from the master or itself
     * If it receives a message containing a tcpJobInitiatorSocket, it will initiate the job contained in the message.
     */
    beginListeningInWorker() {
        // Else if this is a child process,
        // Because process and childprocess do not sufficiently overlap, have to first set it to unknown, then to childprocess.
        const childProcess = process;
        // When the child process receives a message (either from itself or the master)
        childProcess.on('message', (message) => {
            // I haven't set to pass any strings to a child process yet, but I'm leaving this here in case I do in the future
            if (typeof message === 'string') {
                console.log(message);
            }
            else if (typeof message === 'object' && message.task) {
                // At times, the master will send a tasked identifier to the fork to initiate a job
                const taskedIdentifier = message;
                // Add the appropriate listeners and create a TCP server
                let tcpJobInitiatorSocket = new tcp_job_initiator_socket_1.TCPJobInitiatorSocket(taskedIdentifier, childProcess);
                tcpJobInitiatorSocket.addSocketListeners();
                tcpJobInitiatorSocket.tcpDataCompletionEmitter.on('kill-me', () => {
                    var _a;
                    (_a = tcpJobInitiatorSocket) === null || _a === void 0 ? void 0 : _a.tcpDataCompletionEmitter.removeAllListeners();
                    tcpJobInitiatorSocket = null;
                });
            }
        });
    }
}
exports.ForkTasker = ForkTasker;
//# sourceMappingURL=fork-tasker.js.map