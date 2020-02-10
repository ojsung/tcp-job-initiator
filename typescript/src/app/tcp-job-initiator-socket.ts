import { Socket, createConnection } from 'net'
import { ChildProcess } from 'child_process'
import { ITaskedChannelIdentifier } from './models/channel-identifier.interface'
import { ITCPDataResponse } from './models/tcp-data-response.interface'
import childCommunications from '../config/child-communications.js'
import config from '../config/config'
import { ITaskData } from './models/task-data.interface'
import { EventEmitter } from 'events'

const incrementRequests: string = childCommunications.incrementRequests
const decrementRequests: string = childCommunications.decrementRequests

export class TCPJobInitiatorSocket {
  /**
   * A class to communicate across TCP sockets in a child process
   * @param socket The socket
   * @param process The child process
   */
  constructor(private taskedIdentifier: ITaskedChannelIdentifier, private process: ChildProcess) {
    const host: string = taskedIdentifier.targetIp
    const port: number = config.port
    this.socket = createConnection({ host, port })
  }

  public tcpDataCompletionEmitter: EventEmitter = new EventEmitter()
  private fullData: string = ''
  private socket: Socket

  public addSocketListeners() {
    // Get the callback functions for the socket from the TCPJobInitiatorSocket class
    this.socket.on('connect', () => {
      this.connect(this.taskedIdentifier)
    })
    this.socket.on('data', this.dataCallback)
    this.socket.on('end', this.endCallback)
  }

  /**
   * The callback for the connect event
   * @param taskedIdentifier The identifier for the job to be run
   */
  private connect(taskedIdentifier: ITaskedChannelIdentifier) {
    // As the master to increment the number of requests ongoing and total
    this.process.send(incrementRequests)
    // Send the task information across the socket to the destination
    this.socket.write(JSON.stringify(taskedIdentifier) + 'END')
  }

  /**
   * The data callback.  Data will be saved to this.fullData until the 'END' string is sent
   * @param data
   */
  private dataCallback(data: Buffer) {
    this.fullData += data
    if (this.fullData.endsWith('END')) {
      // Should be a JSON...
      const dataAsJSON = JSON.parse(this.fullData.slice(0, -3)) as ITCPDataResponse
      this.process.send({ data: dataAsJSON, taskedIdentifier: this.taskedIdentifier } as ITaskData)
      this.fullData = ''
    }
  }

  /**
   * The end callback.  It will send up an error to the master if an error occurred
   * Also notifies the parent to decrement the number of concurrent jobs
   * @param hadError
   */
  private endCallback(hadError: boolean) {
    if (hadError) {
      this.process.send('ERROR')
    }
    this.process.send(decrementRequests)
    try {
      this.socket.destroy()
      this.socket.removeAllListeners()
    } finally {
      this.tcpDataCompletionEmitter.emit('kill-me')
    }
  }
}
