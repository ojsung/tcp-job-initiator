import { Cluster, Worker } from 'cluster'
import { IForkTracker } from '../models/fork.interface'
import { IChannelIdentifier, ITaskedChannelIdentifier } from '../models/channel-identifier.interface'
import TCPJobInitiator from '..'
import { ChildProcess } from 'child_process'
import { ForkTracker } from './fork-tracker'
import { TCPJobInitiatorSocket } from '../tcp-job-initiator-socket'
import { messageCallback, checkForUnfinishedJobs } from './worker-callbacks'
import { ITaskExit } from '../models/task-exit'
import { JobStatusNotifier } from '../models/job-status-notifier.abstract'
import { ITaskData } from '../models/task-data.interface'

/**
 * @todo add an error handler
 * This helper class helps manage the forks and their jobs from the cluster master.
 * This class can't really survive on its own, and really does need to be paired with ClusterMaster.
 * It's a bit unfortunate, but I saw many drawbacks to writing it any other way.
 */
export class ForkTasker {
  constructor(private cluster: Cluster) {
    cluster.on('message', (worker: Worker, message: any, handle) => {
      const data: ITaskData | void = messageCallback(worker, message, handle)
      if (data) {
        this.jobStatusNotifier.emit('task-complete', data)
      }
    })
    cluster.on('exit', (worker: Worker, code: number, signal: string) => {
      this.jobStatusNotifier.emit('worker-exit', { worker, code, signal } as ITaskExit)
      const unfinishedJobs = checkForUnfinishedJobs(worker)
      if (unfinishedJobs.length) {
        unfinishedJobs.forEach((job: ITaskedChannelIdentifier) => {
          this.initiateJobRequest(job, job.task)
        })
      }
    })
  }
  public jobStatusNotifier: JobStatusNotifier = TCPJobInitiator.jobStatusNotifier
  private forkTracker: ForkTracker = new ForkTracker()

  /**
   * This is the function that will initiate a job within this module
   * @param identifier An identifier, received from the job-requestor
   * @param task The job to be done
   */
  public initiateJobRequest(identifier: IChannelIdentifier, task: string) {
    const taskedIdentifier: ITaskedChannelIdentifier = { ...identifier, task }
    if (!TCPJobInitiator.appIsAwaitingDeath) {
      const cpuLoadIndex: number = this.forkTracker.findMostAvailableJobTakerIndex()
      const fork: IForkTracker = ForkTracker.cpuLoadIndexToForkedCPU[cpuLoadIndex]
      const workerId = fork.id
      const worker: Worker = (this.cluster.workers as { [index: string]: Worker })[
        workerId
      ] as Worker
      // Send the job data to a worker. At this point, all the listeners have been attached.
      worker.send(taskedIdentifier)
    } else {
      this.jobStatusNotifier.emit('unfinished-job', taskedIdentifier)
    }
  }

  /**
   * Listens to worker
   * @todo add a handler for strings
   */
  public listenToWorker() {
    // Else if this is a child process,
    // Because process and childprocess do not sufficiently overlap, have to first set it to unknown, then to childprocess.
    const childProcess: ChildProcess = (process as unknown) as ChildProcess
    // When the child process uses the process.send method
    childProcess.on('message', (message: any) => {
      // If it's a string, do something with the string
      if (typeof message === 'string') {
      } else {
        const taskedIdentifier: ITaskedChannelIdentifier = message as ITaskedChannelIdentifier
        // Add the appropriate listeners and create a TCP server
        const tcpJobInitiatorSocket: TCPJobInitiatorSocket = new TCPJobInitiatorSocket(
          taskedIdentifier,
          childProcess
        )
        tcpJobInitiatorSocket.addSocketListeners()
      }
    })
  }
}
