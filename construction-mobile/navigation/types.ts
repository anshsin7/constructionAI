import type { Classification, Product } from '../lib/types'
import type { DemoUser } from '../lib/users'

export type RootStackParamList = {
  Home: undefined
  TextInput: { user: DemoUser }
  Voice: { user: DemoUser }
  Results: {
    user: DemoUser
    inputMethod: 'image' | 'voice' | 'text'
    classification: Classification
    products: Product[]
  }
  OrderConfirm: {
    user: DemoUser
    inputMethod: 'image' | 'voice' | 'text'
    classification: Classification
    product: Product
    quantity: number
    order: import('../lib/types').Order
    needsApproval: boolean
  }
  MyOrders: { user: DemoUser }
  Approvals: { user: DemoUser }
}
