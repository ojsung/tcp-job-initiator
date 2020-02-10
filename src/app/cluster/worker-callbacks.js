"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fork_tracker_1 = require("./fork-tracker");
const config_1 = __importDefault(require("../../config/config"));
const child_communications_1 = __importDefault(require("../../config/child-communications"));
const cluster_1 = require("cluster");
/**
 * Set the listeners for Cluster to add and subtract from their tasked jobs
based on what message is received from the worker
 * @param worker
 */
function incrementRequestsCallback(worker) {
    const id = worker.id;
    const forkedCPU = fork_tracker_1.ForkTracker.forkedCPUContainer[id];
    // Mark that the fork has accepted another job
    ++forkedCPU.cpuLoadValue;
    ++forkedCPU.jobsTaken;
    // If the fork has taken the proper number of jobs that it should start
    // getting ready for death, set the job to prepare to die
    // This will only happen if no one else is already waiting to die.
    if (forkedCPU.jobsTaken >= config_1.default.jobsUntilDeath) {
        if (fork_tracker_1.ForkTracker.theOneWhoAwaitsDeath === -1) {
            fork_tracker_1.ForkTracker.theOneWhoAwaitsDeath = id;
        }
    }
}
exports.incrementRequestsCallback = incrementRequestsCallback;
function decrementRequestsCallback(worker) {
    const id = worker.id;
    const fork = fork_tracker_1.ForkTracker.forkedCPUContainer[id];
    --fork.cpuLoadValue;
    if (id === fork_tracker_1.ForkTracker.theOneWhoAwaitsDeath) {
        beginKillingProcess(worker, fork);
    }
}
exports.decrementRequestsCallback = decrementRequestsCallback;
function checkForUnfinishedJobs(worker) {
    // Regardless of whether the app is awaiting death or not, we still need to clean up all
    // unfinished jobs.
    const unfinishedJobs = fork_tracker_1.ForkTracker.forkedCPUContainer[worker.id].currentJobs;
    return unfinishedJobs;
}
exports.checkForUnfinishedJobs = checkForUnfinishedJobs;
/**
 * Messages callback
 * @param worker
 * @param message
 * @param _handle
 */
function messageCallback(worker, message, _handle) {
    if (typeof message === 'string') {
        if (message === child_communications_1.default.incrementRequests) {
            incrementRequestsCallback(worker);
        }
        else if (message === child_communications_1.default.decrementRequests) {
            decrementRequestsCallback(worker);
        }
        else {
            console.log(message); // this is where you would add more string callbacks if you need them
        }
    }
    else {
        return message;
    }
}
exports.messageCallback = messageCallback;
function beginKillingProcess(worker, fork) {
    // The function call used to kill the process
    // Set a timer to forcefully kill the process in case it never gracefully dies.
    // This should be done to prevent any massive memory leaks
    let forcefulKill;
    // Set a timer to forcefully kill the process if the process begins gracefully killing itself,
    // but does not do it within the timeout period
    let gracelessKill;
    // Add a listener for when the job actually dies
    worker.on('exit', () => {
        // Stop tracking the worker
        fork_tracker_1.ForkTracker.stopTrackingWorker(worker, fork);
        // reset the kill watcher
        fork_tracker_1.ForkTracker.theOneWhoAwaitsDeath = -1;
        // clear any timeouts
        if (forcefulKill) {
            clearTimeout(forcefulKill);
        }
        if (gracelessKill) {
            clearTimeout(gracelessKill);
        }
        // Check for and kill the next worker who is over their job limit
        setupForNextWorker();
    }); // End of 'exit' listener
    // Prepare for the case that the worker fails to reach a point where
    // it can die gracefully.  The timeout is, be default, 3 hours.  So if it takes
    // longer than three hours to reach a point where it can gracefully die, there's
    // probably something very wrong
    forcefulKill = setupKill(worker, config_1.default.doForceKills, config_1.default.timeoutToForceKill);
    // If the worker does not currently have any active jobs
    if (fork.cpuLoadValue === 0) {
        // Attempt to gracefully kill the worker
        worker.kill();
        // If the timeout for waiting for a graceful kill passes, execute the process
        gracelessKill = setupKill(worker, config_1.default.doForceKillsWhenGracefulKillsFail, config_1.default.timeoutToForceKillWhenGracefulKillFailed);
    }
}
/**
 * Kills process forcefully
 * @param worker The worker to kill
 */
function killProcess(worker) {
    if (!worker.isDead()) {
        worker.process.kill();
    }
}
/**
 * Sets up a timer to kill the worker
 * @param worker The worker to kill
 * @param doKill A boolean that says whether or not the app is set up to allow killing workers
 * @param killTimer How long to wait before killing the worker
 * @returns The timer or null, depending on whether the app is allowed to kill workers or not
 */
function setupKill(worker, doKill, killTimer) {
    if (doKill) {
        return setTimeout(() => {
            killProcess(worker);
        }, killTimer);
    }
    else
        return null;
}
/**
 * Setups for next worker.  If there is another worker who is over their job limit
 * this function will begin the process of killing them.
 */
function setupForNextWorker() {
    // Kill the next worker in line, if there is one
    const forks = fork_tracker_1.ForkTracker.forks;
    const forksLength = forks.length;
    for (let i = 0, j = forksLength; i < j; ++i) {
        const currentId = forks[i];
        const currentFork = fork_tracker_1.ForkTracker.forkedCPUContainer[currentId];
        if (currentFork.jobsTaken >= config_1.default.jobsUntilDeath) {
            for (let index in cluster_1.workers) {
                // I'm not a huge lover of for-in loops, but this object should be small enough
                // that it doesn't matter.
                const worker = cluster_1.workers[index];
                if (worker && worker.id === currentFork.id) {
                    beginKillingProcess(worker, currentFork);
                }
                break;
            }
            break;
        }
    }
}
//# sourceMappingURL=worker-callbacks.js.map