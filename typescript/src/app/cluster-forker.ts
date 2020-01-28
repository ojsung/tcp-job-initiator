import { Cluster, Worker } from 'cluster'
import { findMinIndex } from './find-min-index'
import { IForkTracker, IForkContainer } from './models/fork.interface'
import childCommunications from '../config/child-communications.json'
import config from '../config/config'

const incrementRequests: string = childCommunications.incrementRequests
const decrementRequests: string = childCommunications.decrementRequests

/**
 * @todo add an error handler
 */
export class ClusterForker {
  constructor(private cluster: Cluster) {
    // Set the listeners for Cluster to add and subtract from their tasked jobs
    // based on what message is received from the worker
    cluster.on(incrementRequests, (worker: Worker) => {
      const id = worker.id
      const forkedCPU: IForkTracker = this.forkedCPUContainer[id]
      // Mark that the fork has accepted another job
      ++forkedCPU.cpuLoadValue
      ++forkedCPU.jobsTaken
      // If the fork has taken the proper number of jobs that it should start
      // getting ready for death, set the job to prepare to die
      // This will only happen if no one else is already waiting to die.
      if (forkedCPU.jobsTaken >= config.jobsUntilDeath) {
        if (this.theOneWhoAwaitsDeath !== -1) {
          this.theOneWhoAwaitsDeath = id
        }
      }
    })
    cluster.on(decrementRequests, (worker: Worker) => {
      const id = worker.id
      const fork = this.forkedCPUContainer[id]
      --fork.cpuLoadValue
      if (id === this.theOneWhoAwaitsDeath) {
        this.beginKillingProcess(worker, fork)
      }
    })
    cluster.on('exit', () => {
      this.createFork()
    })
    cluster.on('message', (_worker, message, _handle) => {
      console.log(message) // like for real replace this
    })
  }
  public forkedCPUContainer: IForkContainer = {}
  public cpuLoadIndexToForkedCPU: { [cpuLoadIndex: number]: IForkTracker } = {}
  public cpuLoadContainer: number[] = []
  public theOneWhoAwaitsDeath: number = -1
  private get forks(): number[] {
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
    let cpuLoadIndex = findMinIndex(this.cpuLoadContainer, indicesToIgnore)
    // const forkedCPU = forkedCPUs[cpuLoadToForkedCPU[cpuLoadIndex]]
    const forkedCPU: IForkTracker = this.cpuLoadIndexToForkedCPU[cpuLoadIndex]
    // Verify that the job taker found is not awaiting death
    if (this.theOneWhoAwaitsDeath === forkedCPU.id) {
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

  public createFork() {
    // Create the fork and get its id
    const worker = this.cluster.fork()
    const workerId = worker.id
    // Set the highest possible index in the cpuLoad array for this worker
    const cpuLoadLastIndex = this.cpuLoadContainer.length + 1
    let cpuIndex: number = cpuLoadLastIndex
    for (let i = 0, j = cpuLoadLastIndex; i < j; ++i) {
      const currentLoad = this.cpuLoadContainer[i]
      // If at any point, a lower, unoccupied spot is found in the cpuLoad array
      // for this worker, assign them to that spot instead.
      if (currentLoad === undefined) {
        cpuIndex = i
        this.cpuLoadContainer[i] = 0
        break
      }
    }
    // Get the value of the cpuLoad for this fork
    const getLoadValue = () => {
      const cpuLoadValue: number = this.cpuLoadContainer[cpuIndex]
      return cpuLoadValue
    }
    // Set the value of the cpuLoad for this fork
    const setLoadValue = (num: number) => {
      this.cpuLoadContainer[cpuIndex] += num
    }
    // create an entry in forkedCPUContainer for this worker, and store
    // their current information
    this.forkedCPUContainer[workerId] = {
      jobsTaken: 0,
      get cpuLoadValue(): number {
        return getLoadValue()
      },
      set cpuLoadValue(num: number) {
        setLoadValue(num)
      },
      id: workerId
    }
    // Create a dictionary that can be used to easily refer back to the forkedCPU
    // from the cpuLoad array
    this.cpuLoadIndexToForkedCPU[cpuIndex] = this.forkedCPUContainer[workerId]
  }

  private beginKillingProcess(worker: Worker, fork: IForkTracker) {
    // The function call used to kill the process
    const killProcess = () => {
      if (!worker.isDead()) worker.process.kill()
    }
    // Set a timer to forcefully kill the process in case it never gracefully dies.
    // This should be done to prevent any massive memory leaks
    let forcefulKill: NodeJS.Timeout
    // Set a timer to forcefully kill the process if the process begins gracefully killing itself,
    // but does not do it within the timeout period
    let gracelessKill: NodeJS.Timeout
    if (config.doForceKills) {
      forcefulKill = setTimeout(killProcess, config.timeoutToForceKill)
    }
    if (fork.cpuLoadValue === 0) {
      // Attempt to gracefully kill the worker
      worker.kill()
      // If the timeout for waiting for a graceful kill passes, execute the process
      if (config.doForceKillsWhenGracefulKillsFail) {
        gracelessKill = setTimeout(() => {
          killProcess()
        }, config.timeoutToForceKillWhenGracefulKillFailed)
      }
    }
    worker.on('exit', () => {
      // reset the kill watcher
      this.theOneWhoAwaitsDeath = -1
      // clear any timeouts
      if (forcefulKill) {
        clearTimeout(forcefulKill)
      }
      if (gracelessKill) {
        clearTimeout(gracelessKill)
      }
      const forks: number[] = this.forks
      const forksLength = forks.length
      for (let i = 0, j = forksLength; i < j; ++i) {
        const currentId = forks[i]
        const currentFork = this.forkedCPUContainer[currentId]
        if (currentFork.jobsTaken >= config.jobsUntilDeath) {
          this.beginKillingProcess(worker, currentFork)
          break
        }
      }
    })
  }
}
