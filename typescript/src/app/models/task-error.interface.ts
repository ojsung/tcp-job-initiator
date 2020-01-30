import { ITaskedChannelIdentifier } from './channel-identifier.interface'
import { ITCPDataResponse } from './tcp-data-response.interface'

export interface ITaskError {
  task: ITaskedChannelIdentifier
  error: Error
  data?: ITCPDataResponse
}
