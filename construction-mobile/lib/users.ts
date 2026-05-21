export type DemoUser = {
  id: string
  name: string
  role: 'worker' | 'approver'
  budget_limit: number
}

export const MARCO: DemoUser = {
  id: '22222222-2222-2222-2222-222222222201',
  name: 'Marco',
  role: 'worker',
  budget_limit: 50
}

export const SARA: DemoUser = {
  id: '22222222-2222-2222-2222-222222222202',
  name: 'Sara',
  role: 'approver',
  budget_limit: 500
}
