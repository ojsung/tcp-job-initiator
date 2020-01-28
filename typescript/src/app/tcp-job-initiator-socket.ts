import { Socket } from 'net'
import { ChildProcess } from 'child_process'
import { ITaskedChannelIdentifier } from './models/channel-identifier.interface'
import { IDataResponse } from './models/data-response.interface'
import childCommunications from '../config/child-communications.json'

const incrementRequests: string = childCommunications.incrementRequests
const decrementRequests: string = childCommunications.decrementRequests

export class TCPJobInitiatorSocket {
  /**
   * A class to communicate across TCP sockets in a child process
   * @param socket The socket
   * @param process The child process
   */
  constructor(private socket: Socket, private process: ChildProcess) {}
  private fullData: string = ''
  /**
   * The callback for the connect event
   * @param taskedIdentifier The identifier for the job to be run
   */
  public connect(taskedIdentifier: ITaskedChannelIdentifier) {
    // As the master to increment the number of requests ongoing and total
    this.process.send(incrementRequests)
    // Send the task information across the socket to the destination
    this.socket.write(JSON.stringify(taskedIdentifier) + 'END')
  }

  /**
   * The data callback.  Data will be saved to this.fullData until the 'END' string is sent
   * @param data
   */
  public data(data: Buffer) {
    this.fullData += data
    if (this.fullData.endsWith('END')) {
      // Should be a JSON...
      const dataAsJSON = JSON.parse(this.fullData.slice(0, -3)) as IDataResponse
      this.process.send(dataAsJSON)
      this.fullData = ''
    }
  }

  /**
   * The end callback.  It will send up an error to the master if an error occurred
   * Also notifies the parent to decrement the number of concurrent jobs
   * @param hadError
   */
  public end(hadError: boolean) {
    if (hadError) {
      this.process.send('ERROR')
    }
    this.process.send(decrementRequests)
  }
}
