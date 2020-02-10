import { EventEmitter } from 'events'
import { ForkTasker } from './fork-tasker'
import { Cluster, Worker } from 'cluster'
import config from '../../config/config'
import { cpus } from 'os'
import TCPJobInitiator from '..'
import { ForkTracker } from './fork-tracker'
import { JobStatusNotifier } from '../models/job-status-notifier.abstract'

export class ClusterMaster {

  constructor(private readonly cluster: Cluster, private readonly forkTasker: ForkTasker) {
    // Set up a listener for dead workers.  If a worker has died,
    // call createFork to evaluate whether a new worker should be spawned
    TCPJobInitiator.jobStatusNotifier.on('worker-exit', () => {
      this.createFork()
    })
  }
  /**
   *   Notifies the controller of any errors or responses received from the tasks run
   * This allows the parent to go on about its business after sending down a job without having
   * to wait on the app to finish, whether synchronously or asynchronously
   */
  public static readonly errorAndResponseNotifier: JobStatusNotifier = new EventEmitter()
  /**
   *  This static boolean value makes sure that, globally, the forking process only
   *  occurs once in the lifespan of the application
   */
  public static forksCreated: boolean = false

  /**
   * Initiates forking the cluster.  It also adds listeners to jobStatusNotifier
   * that will handle any dying workers or unfinished jobs.
   */
  public initiateForking() {
    let numForks: number
    // If this is the master,
    if (this.cluster.isMaster) {
      // check if the config file contains a valid number of forks to create
      if (config.totalForks && config.totalForks > 0) {
        numForks = config.totalForks
      } else {
        // if the config doesn't have a valid number in totalForks, create as
        // many forks as we have cpus
        numForks = cpus.length
      }
      for (let i = 0, j = numForks; i < j; ++i) {
        this.createFork()
      }
      ClusterMaster.forksCreated = true
    } else {
      this.forkTasker.beginListeningInWorker()
    }
  }

  /**
   * Creates forks if the app is not awaiting death.  Asks forkTasker to
   * start tracking them.
   */
  private createFork() {
    if (!TCPJobInitiator.appIsAwaitingDeath) {
      const newWorker = this.cluster.fork()
      ForkTracker.beginTrackingWorker(newWorker)
    } else {
      // If the app is awaiting death, check to see if the app has killed all of its workers.  If it has, notify the master that it is ready to die.
      if (Object.keys(this.cluster.workers as {[index: string]: Worker}).length === 0 && TCPJobInitiator.appIsAwaitingDeath) {
        TCPJobInitiator.deathMonitor.emit('ready-to-die')
      }
    }
  }
}
