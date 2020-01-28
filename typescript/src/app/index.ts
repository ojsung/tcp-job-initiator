import cluster, { Worker, Cluster } from 'cluster'
import net, { Socket } from 'net'
import { cpus } from 'os'
import { IForkTracker } from './models/fork.interface'
import config from '../config/config.js'
import { ChildProcess } from 'child_process'
import { IChannelIdentifier, ITaskedChannelIdentifier } from './models/channel-identifier.interface'
import { ClusterForker } from './cluster-forker'
import { TCPJobInitiatorSocket } from './tcp-job-initiator-socket'

/**
 * @todo Add a handler for when the incoming message from the child process is a string
 */
const clusterForker: ClusterForker = new ClusterForker((cluster as unknown) as Cluster)

if (cluster.isMaster) {
  const numCPUs = cpus.length
  for (let i = 0, j = numCPUs; i < j; ++i) {
    clusterForker.createFork()
  }
} else {
  // Because process and childprocess do not sufficiently overlap, have to first set it to unknown, then to childprocess.
  const childProcess: ChildProcess = (process as unknown) as ChildProcess
  // When the child process uses the process.send method, accept the taskedIdentifier from them and
  childProcess.on('message', (message: any) => {
    if (typeof message === 'string') {
      // do something
    } else {
      const taskedIdentifier = message as ITaskedChannelIdentifier

      const host: string = taskedIdentifier.targetIp
      const port: number = config.port
      const socket: Socket = net.createConnection({ host, port })
      const tcpJobInitiatorSocket: TCPJobInitiatorSocket = new TCPJobInitiatorSocket(
        socket,
        childProcess
      )
      socket.on('connect', () => {
        tcpJobInitiatorSocket.connect(taskedIdentifier)
      })
      socket.on('data', tcpJobInitiatorSocket.data)
      socket.on('end', tcpJobInitiatorSocket.end)
    }
  })
}

export function initiateJobRequest(identifier: IChannelIdentifier, task: string) {
  const cpuLoadIndex: number = clusterForker.findMostAvailableJobTakerIndex()
  const fork: IForkTracker = clusterForker.cpuLoadIndexToForkedCPU[cpuLoadIndex]
  const workerId = fork.id
  const worker: Worker = cluster.workers[workerId] as Worker
  const taskedIdentifier: ITaskedChannelIdentifier = { ...identifier, task }
  worker.send(taskedIdentifier)
}
