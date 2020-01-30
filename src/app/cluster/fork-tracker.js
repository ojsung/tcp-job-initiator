"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const find_min_index_1 = require("../tools/find-min-index");
class ForkTracker {
    static get forks() {
        return Object.keys(this.forkedCPUContainer).map((key) => parseInt(key, 10));
    }
    /**
     * Searches for the index of the most available job taker.  If that job taker is awaiting death, then it will search for a different job taker.
     * @param [indicesToIgnore] Optional. An array of numbers containing the indices to ignore when searching for the
     * index of the most available job taker.
     * @returns cpuLoadIndex, or rather, the index of the lowest value in the cpuLoad array
     */
    findMostAvailableJobTakerIndex(indicesToIgnore = []) {
        // This will be a value greater than or equal to zero on the initial run, since indicesToIgnore will be empty
        let cpuLoadIndex = find_min_index_1.findMinIndex(ForkTracker.cpuLoadContainer, indicesToIgnore);
        // const forkedCPU = forkedCPUs[cpuLoadToForkedCPU[cpuLoadIndex]]
        const forkedCPU = ForkTracker.cpuLoadIndexToForkedCPU[cpuLoadIndex];
        // Verify that the job taker found is not awaiting death
        if (ForkTracker.theOneWhoAwaitsDeath === forkedCPU.id) {
            indicesToIgnore.push(cpuLoadIndex);
            const newJobTakerIndex = this.findMostAvailableJobTakerIndex(indicesToIgnore);
            // Because findMinIndex will return -1 if it failed to find a minimum index for any reason when a non-empty
            // "indicesToIgnore" is provided, we only take the value of it when the value returned is greater than or equal to 0
            if (newJobTakerIndex >= 0) {
                cpuLoadIndex = newJobTakerIndex;
            }
        }
        return cpuLoadIndex;
    }
    static beginTrackingWorker(worker) {
        const workerId = worker.id;
        // Set the highest possible index in the cpuLoad array for this worker
        const cpuLoadLastIndex = ForkTracker.cpuLoadContainer.length + 1;
        let cpuIndex = cpuLoadLastIndex;
        for (let i = 0, j = cpuLoadLastIndex; i < j; ++i) {
            const currentLoad = ForkTracker.cpuLoadContainer[i];
            // If at any point, a lower, unoccupied spot is found in the cpuLoad array
            // for this worker, assign them to that spot instead.
            if (currentLoad === undefined) {
                cpuIndex = i;
                ForkTracker.cpuLoadContainer[i] = 0;
                break;
            }
        }
        // Get the value of the cpuLoad for this fork
        const getLoadValue = () => {
            const cpuLoadValue = ForkTracker.cpuLoadContainer[cpuIndex];
            return cpuLoadValue;
        };
        // Set the value of the cpuLoad for this fork
        const setLoadValue = (num) => {
            ForkTracker.cpuLoadContainer[cpuIndex] += num;
        };
        // create an entry in forkedCPUContainer for this worker, and store
        // their current information
        ForkTracker.forkedCPUContainer[workerId] = {
            jobsTaken: 0,
            get cpuLoadValue() {
                return getLoadValue();
            },
            set cpuLoadValue(num) {
                setLoadValue(num);
            },
            cpuLoadIndex: cpuIndex,
            id: workerId,
            currentJobs: []
        };
        // Create a dictionary that can be used to easily refer back to the forkedCPU
        // from the cpuLoad array
        ForkTracker.cpuLoadIndexToForkedCPU[cpuIndex] = ForkTracker.forkedCPUContainer[workerId];
    }
    static stopTrackingWorker(worker, fork) {
        delete ForkTracker.cpuLoadContainer[fork.cpuLoadIndex];
        for (let index in ForkTracker.cpuLoadIndexToForkedCPU) {
            if (ForkTracker.cpuLoadIndexToForkedCPU[index] === fork) {
                delete ForkTracker.cpuLoadIndexToForkedCPU[index];
            }
            break;
        }
        delete ForkTracker.forkedCPUContainer[worker.id];
    }
}
exports.ForkTracker = ForkTracker;
ForkTracker.forkedCPUContainer = {};
ForkTracker.cpuLoadIndexToForkedCPU = {};
ForkTracker.cpuLoadContainer = [];
ForkTracker.theOneWhoAwaitsDeath = -1;
//# sourceMappingURL=fork-tracker.js.map