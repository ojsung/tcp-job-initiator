import { ITaskedChannelIdentifier } from './channel-identifier.interface'
import { ITCPDataResponse } from './tcp-data-response.interface'

export interface ITaskError {
  taskedIdentifier: ITaskedChannelIdentifier
  error: Error
  data?: ITCPDataResponse
}
