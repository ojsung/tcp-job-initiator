import { Cluster, Worker } from 'cluster'
import { IForkTracker } from '../models/fork.interface'
import {
  IChannelIdentifier,
  ITaskedChannelIdentifier
} from '../models/channel-identifier.interface'
import TCPJobInitiator from '..'
import { ChildProcess } from 'child_process'
import { ForkTracker } from './fork-tracker'
import { TCPJobInitiatorSocket } from '../tcp-job-initiator-socket'
import { messageCallback, checkForUnfinishedJobs } from './worker-callbacks'
import { ITaskExit } from '../models/task-exit.interface'
import { JobStatusNotifier } from '../models/job-status-notifier.abstract'
import { ITaskData } from '../models/task-data.interface'

/**
 * This helper class helps manage the forks and their jobs from the cluster master.
 * This class can't really survive on its own, and really does need to be paired with ClusterMaster.
 * It's a bit unfortunate, but I saw many drawbacks to writing it any other way.
 */
export class ForkTasker {
  constructor(private cluster: Cluster) {
    cluster.on('message', (worker: Worker, message: any, handle) => {
      // messageCallback (which didn't end up being a call back after all) wil
      // return void if it was fed a string.  Strings have their own callbacks that are
      // handled separately
      const data: ITaskData | void = messageCallback(worker, message, handle)
      if (data) {
        // If it wasn't a string, then it was a task completion notification.
        // In that case, notify anyone listening on jobStatusNotifier that
        // the task is now complete, and pass them the data
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
   * Instructs the worker to begin listening to messages from the master or itself
   * If it receives a message containing a tcpJobInitiatorSocket, it will initiate the job contained in the message.
   */
  public beginListeningInWorker() {
    // Else if this is a child process,
    // Because process and childprocess do not sufficiently overlap, have to first set it to unknown, then to childprocess.
    const childProcess: ChildProcess = (process as unknown) as ChildProcess
    // When the child process receives a message (either from itself or the master)
    childProcess.on('message', (message: any) => {
      // I haven't set to pass any strings to a child process yet, but I'm leaving this here in case I do in the future
      if (typeof message === 'string') {
        console.log(message)
      } else if (typeof message === 'object' && message.task) {
        // At times, the master will send a tasked identifier to the fork to initiate a job
        const taskedIdentifier: ITaskedChannelIdentifier = message as ITaskedChannelIdentifier
        // Add the appropriate listeners and create a TCP server
        let tcpJobInitiatorSocket: TCPJobInitiatorSocket | null = new TCPJobInitiatorSocket(
          taskedIdentifier,
          childProcess
        )
        tcpJobInitiatorSocket.addSocketListeners()
        tcpJobInitiatorSocket.tcpDataCompletionEmitter.on('kill-me', () => {
          tcpJobInitiatorSocket?.tcpDataCompletionEmitter.removeAllListeners()
          tcpJobInitiatorSocket = null
        })
      }
    })
  }
}
