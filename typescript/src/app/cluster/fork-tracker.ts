import { Worker } from 'cluster'
import { IForkTracker, IForkContainer } from '../models/fork.interface'
import { findMinIndex } from '../tools/find-min-index'

export class ForkTracker {
  public static readonly forkedCPUContainer: IForkContainer = {}
  public static readonly cpuLoadIndexToForkedCPU: { [cpuLoadIndex: number]: IForkTracker } = {}
  public static readonly cpuLoadContainer: number[] = []
  public static theOneWhoAwaitsDeath: number = -1
  public static get forks(): number[] {
    return Object.keys(this.forkedCPUContainer).map((key: string) => parseInt(key, 10))
  }

  /**
   * Searches for the index of the most available job taker.  If that job taker is awaiting death, then it will search for a different job taker.
   * @param [indicesToIgnore] Optional. An array of numbers containing the indices to ignore when searching for the
   * index of the most available job taker.
   * @returns cpuLoadIndex, or rather, the index of the lowest value in the cpuLoad array
   */
  public findMostAvailableJobTakerIndex(indicesToIgnore: number[] = []) {
    // This will be a value greater than or equal to zero on the initial run, since indicesToIgnore will be empty
    let cpuLoadIndex = findMinIndex(ForkTracker.cpuLoadContainer, indicesToIgnore)
    // const forkedCPU = forkedCPUs[cpuLoadToForkedCPU[cpuLoadIndex]]
    const forkedCPU: IForkTracker = ForkTracker.cpuLoadIndexToForkedCPU[cpuLoadIndex]
    // Verify that the job taker found is not awaiting death
    if (ForkTracker.theOneWhoAwaitsDeath === forkedCPU.id) {
      indicesToIgnore.push(cpuLoadIndex)
      const newJobTakerIndex = this.findMostAvailableJobTakerIndex(indicesToIgnore)
      // Because findMinIndex will return -1 if it failed to find a minimum index for any reason when a non-empty
      // "indicesToIgnore" is provided, we only take the value of it when the value returned is greater than or equal to 0
      if (newJobTakerIndex >= 0) {
        cpuLoadIndex = newJobTakerIndex
      }
    }
    return cpuLoadIndex
  }

  public static beginTrackingWorker(worker: Worker) {
    const workerId = worker.id
    // Set the highest possible index in the cpuLoad array for this worker
    const cpuLoadLastIndex = ForkTracker.cpuLoadContainer.length + 1
    let cpuIndex: number = cpuLoadLastIndex
    for (let i = 0, j = cpuLoadLastIndex; i < j; ++i) {
      const currentLoad = ForkTracker.cpuLoadContainer[i]
      // If at any point, a lower, unoccupied spot is found in the cpuLoad array
      // for this worker, assign them to that spot instead.
      if (currentLoad === undefined) {
        cpuIndex = i
        ForkTracker.cpuLoadContainer[i] = 0
        break
      }
    }
    // Get the value of the cpuLoad for this fork
    const getLoadValue = () => {
      const cpuLoadValue: number = ForkTracker.cpuLoadContainer[cpuIndex]
      return cpuLoadValue
    }
    // Set the value of the cpuLoad for this fork
    const setLoadValue = (num: number) => {
      ForkTracker.cpuLoadContainer[cpuIndex] += num
    }
    // create an entry in forkedCPUContainer for this worker, and store
    // their current information
    ForkTracker.forkedCPUContainer[workerId] = {
      jobsTaken: 0,
      get cpuLoadValue(): number {
        return getLoadValue()
      },
      set cpuLoadValue(num: number) {
        setLoadValue(num)
      },
      cpuLoadIndex: cpuIndex,
      id: workerId,
      currentJobs: []
    }
    // Create a dictionary that can be used to easily refer back to the forkedCPU
    // from the cpuLoad array
    ForkTracker.cpuLoadIndexToForkedCPU[cpuIndex] = ForkTracker.forkedCPUContainer[workerId]
  }

  public static stopTrackingWorker(worker: Worker, fork: IForkTracker) {
    delete ForkTracker.cpuLoadContainer[fork.cpuLoadIndex]
    for (let index in ForkTracker.cpuLoadIndexToForkedCPU) {
      if (ForkTracker.cpuLoadIndexToForkedCPU[index] === fork) {
        delete ForkTracker.cpuLoadIndexToForkedCPU[index]
      }
      break
    }
    delete ForkTracker.forkedCPUContainer[worker.id]
  }
}
