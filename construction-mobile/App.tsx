import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import type { RootStackParamList } from './navigation/types'
import { HomeScreen } from './screens/HomeScreen'
import { TextInputScreen } from './screens/TextInputScreen'
import { VoiceScreen } from './screens/VoiceScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { OrderConfirmScreen } from './screens/OrderConfirmScreen'
import { MyOrdersScreen } from './screens/MyOrdersScreen'
import { ApprovalsScreen } from './screens/ApprovalsScreen'
import { MARCO, type DemoUser } from './lib/users'
import { colors } from './lib/theme'

const Stack = createNativeStackNavigator<RootStackParamList>()

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.primary
  }
}

export default function App() {
  const [user, setUser] = useState<DemoUser>(MARCO)

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' }
        }}
      >
        <Stack.Screen name="Home" options={{ headerShown: false }}>
          {(props) => (
            <HomeScreen {...props} user={user} onSwitchUser={setUser} />
          )}
        </Stack.Screen>
        <Stack.Screen name="TextInput" component={TextInputScreen} options={{ title: 'Text' }} />
        <Stack.Screen name="Voice" component={VoiceScreen} options={{ title: 'Voice' }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Products' }} />
        <Stack.Screen
          name="OrderConfirm"
          component={OrderConfirmScreen}
          options={{ title: 'Order', headerBackVisible: false }}
        />
        <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
        <Stack.Screen name="Approvals" component={ApprovalsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
