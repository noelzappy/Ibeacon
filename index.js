/**
 * @format
 */

import {AppRegistry, Platform} from 'react-native';
import PushNotification, {Importance} from 'react-native-push-notification';

import App from './App';
import {name as appName} from './app.json';

// Must be outside of any component LifeCycle (such as `componentDidMount`).
PushNotification.configure({
  onRegister: function (token) {
    console.log('TOKEN:', token);
  },

  // (required) Called when a remote is received or opened, or local notification is opened
  onNotification: function (notification) {
    console.log('NOTIFICATION:', notification);
    // notification.finish(PushNotificationIOS.FetchResult.NoData);
  },

  permissions: {
    alert: true,
    badge: true,
    sound: true,
  },

  popInitialNotification: true,

  requestPermissions: Platform.OS === 'ios',
});

PushNotification.createChannel({
  channelId: 'beacon-app-channel-id',
  channelName: 'Beacon App Channel',
  channelDescription: 'A channel to categorise your notifications',
  playSound: true,
  soundName: 'default',
  importance: Importance.HIGH,
  vibrate: true,
});

AppRegistry.registerComponent(appName, () => App);
