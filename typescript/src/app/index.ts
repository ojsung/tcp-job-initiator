import cluster from 'cluster'
import { IChannelIdentifier } from './models/channel-identifier.interface'
import { ForkTasker } from './cluster/fork-tasker'
import { EventEmitter } from 'events'
import { ClusterMaster } from './cluster/cluster-master'
import { JobStatusNotifier } from './models/job-status-notifier.abstract'

/**
 * Tcpjob initiator
 */
export default class TCPJobInitiator {
  constructor() {
    // Check if there are listeners subscribed to the die and undie events for the death monitor.
    // If there aren't, add them.
    const dieDeathMonitorListeners = TCPJobInitiator.deathMonitor.listeners('die')
    const undieDeathMonitorListeners = TCPJobInitiator.deathMonitor.listeners('undie')
    if (!dieDeathMonitorListeners.length) {
      TCPJobInitiator.deathMonitor.on('die', () => (TCPJobInitiator._appIsAwaitingDeath = true))
    }
    if (!undieDeathMonitorListeners.length) {
      TCPJobInitiator.deathMonitor.on('undie', () => (TCPJobInitiator._appIsAwaitingDeath = false))
    }
    // If workers haven't been spawned, spawn the workers
    if (!ClusterMaster.forksCreated) {
      this.clusterMaster.initiateForking()
    }
  }

  /**
   *   This event emitter will be used to let the app know it needs to die.
   * I could add that functionality into the errorAndResponseNotifier event emitter.
   * But that is messy.  They have different jobs, they should be different emitters.
   * The only two listeners for deathMonitor are 'die', which instructs the app to begin prepping for death,
   * or 'undie', which instructs the app to resume business as usual.  I can't see any reason why
   * we'd ever want to 'undie' the app, rather than just letting it die and rebooting it.  But you never know.
   */
  public static readonly deathMonitor: EventEmitter = new EventEmitter()

  /**
   * @inheritDoc
   */
  public static readonly jobStatusNotifier: JobStatusNotifier = new EventEmitter()
  /**
   * When this value is true, the app will stop accepting new jobs.
   */
  private readonly clusterAsCluster: cluster.Cluster = (cluster as unknown) as cluster.Cluster
  private static _appIsAwaitingDeath = false
  private clusterForker: ForkTasker = new ForkTasker(this.clusterAsCluster)
  private clusterMaster: ClusterMaster = new ClusterMaster(
    this.clusterAsCluster,
    this.clusterForker
  )
  /**
   * When this value is true, the app will stop accepting new jobs.
   * This value should not be changed directly.  Actually, I'm gonna make it a
   * getter so that it specifically can't be changed directly.  Instead, it should be changed
   * by emitting a 'die' event from the 'deathMonitor' event emitter
   */
  public static get appIsAwaitingDeath() {
    return this._appIsAwaitingDeath
  }
  public initiateJobRequest(identifier: IChannelIdentifier, task: string) {
    this.clusterForker.initiateJobRequest(identifier, task)
  }
}
