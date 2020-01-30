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
 * @todo add an error handler
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
            const data = worker_callbacks_1.messageCallback(worker, message, handle);
            if (data) {
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
     * Listens to worker
     * @todo add a handler for strings
     */
    listenToWorker() {
        // Else if this is a child process,
        // Because process and childprocess do not sufficiently overlap, have to first set it to unknown, then to childprocess.
        const childProcess = process;
        // When the child process uses the process.send method
        childProcess.on('message', (message) => {
            // If it's a string, do something with the string
            if (typeof message === 'string') {
            }
            else {
                const taskedIdentifier = message;
                // Add the appropriate listeners and create a TCP server
                const tcpJobInitiatorSocket = new tcp_job_initiator_socket_1.TCPJobInitiatorSocket(taskedIdentifier, childProcess);
                tcpJobInitiatorSocket.addSocketListeners();
            }
        });
    }
}
exports.ForkTasker = ForkTasker;
//# sourceMappingURL=fork-tasker.js.map