import React, {Component} from 'react';
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  Switch,
  View,
  Alert,
  Platform,
  ScrollView,
  PermissionsAndroid,
  TouchableOpacity,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Beacons from 'react-native-beacons-manager';
import BeaconBroadcast from '@jaidis/react-native-ibeacon-simulator';
import 'react-native-get-random-values';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

class App extends Component {
  beaconsDidRangeEvent = null;
  beaconsServiceDidConnect = null;
  authStateDidRangeEvent = null;

  regionId = 'REGION1';

  state = {
    // Beacon preferences
    //uuid: require('uuid-by-string')(DeviceInfo.getUniqueId(), 5),
    uuid: '8beb7e40-9181-50d4-aff2-0f26fdc25f28',
    identifier: 'RN-Beacon-Reloaded',

    isTransmitterEnable: false,
    isListenerEnable: false,

    beacons: null,
  };

  componentDidUpdate(prevState) {
    const {beacons} = this.state;
    if (beacons !== prevState.beacons) {
      if (Platform.OS === 'android') {
        this.triggerNotification(
          'New Beacon',
          'New Beacon Was Detected, Click to View',
        );
      } else {
        this.triggerNotificationIOS(
          'New Beacon',
          'New Beacon Was Detected, Click to View',
        );
      }
    }
  }

  exceptionAlert(title, exception) {
    Alert.alert(
      title + ' Exception',
      'Details for developer: ' + JSON.stringify(exception),
    );
  }

  async requestLocationPermission() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Beacon needs to access your location.',
        },
      );
      console.log('PERMISSIONS.ACCESS_FINE_LOCATION = ' + granted);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  beaconsUpdateTick(updatedBeacons) {
    const unliveTicksLimit = 5;
    let currentBeacons = this.state.beacons ?? [];

    for (let i = 0; i < currentBeacons?.length; i++) {
      const b = currentBeacons[i];
      b.unliveTicks++;
    }

    for (let i = 0; i < updatedBeacons.length; i++) {
      const b = updatedBeacons[i];
      b.unliveTicks = 0;
      const bId = currentBeacons?.findIndex(t => t.uuid == b.uuid);
      if (bId > -1) {
        currentBeacons[bId] = b;
      } else {
        currentBeacons.push(b);
      }
    }

    currentBeacons = currentBeacons?.filter(
      t => t.unliveTicks < unliveTicksLimit,
    );
    this.setState({beacons: currentBeacons});
  }

  async startRanging() {
    if (Platform.OS == 'android') {
      if (await this.requestLocationPermission()) {
        try {
          const {identifier, uuid} = this.state;
          const region = {identifier, uuid};

          Beacons.detectIBeacons();

          this.beaconsServiceDidConnect =
            Beacons.BeaconsEventEmitter.addListener(
              'beaconServiceConnected',
              () => {
                console.log('beaconServiceConnected connected');
                Beacons.startRangingBeaconsInRegion(this.regionId)
                  .then(() =>
                    console.log('Beacons ranging started succesfully'),
                  )
                  .catch(error =>
                    console.log(`Beacons ranging not started, error: ${error}`),
                  );

                this.beaconsDidRangeEvent =
                  Beacons.BeaconsEventEmitter.addListener(
                    'beaconsDidRange',
                    data => {
                      console.log('beaconsDidRange data: ', data);
                      this.beaconsUpdateTick(data.beacons);
                    },
                  );
              },
            );
        } catch (e) {
          console.log('Start Ranging Activation Exception: ', +e);
          alert('Start Ranging Activation', e);
        }
      } else {
        console.log('Location permission denied!');
        Alert.alert(
          'Location permission',
          "Application couldn't work w/o permission.",
        );
      }
    } else if (Platform.OS == 'ios') {
      try {
        const {identifier, uuid} = this.state;
        const region = {identifier, uuid};

        this.authStateDidRangeEvent = Beacons.BeaconsEventEmitter.addListener(
          'authorizationStatusDidChange',
          info => console.log('authorizationStatusDidChange: ', info),
        );

        Beacons.requestWhenInUseAuthorization();

        Beacons.startRangingBeaconsInRegion(region)
          .then(() => console.log('Beacons ranging started succesfully'))
          .catch(error =>
            console.log(`Beacons ranging not started, error: ${error}`),
          );

        this.beaconsDidRangeEvent = Beacons.BeaconsEventEmitter.addListener(
          'beaconsDidRange',
          data => {
            console.log('beaconsDidRange data: ', data);
            this.beaconsUpdateTick(data.beacons);
          },
        );
      } catch (e) {
        console.log('Start Ranging Activation Exception: ', +e);
        alert('Start Ranging Activation', e);
      }
    }
  }

  stopRanging() {
    const {identifier, uuid} = this.state;
    const region = {identifier, uuid};

    Beacons.stopRangingBeaconsInRegion(region)
      .then(() => console.log('Beacons ranging stopped succesfully'))
      .catch(error =>
        console.log(`Beacons ranging not stopped, error: ${error}`),
      );

    this.beaconsDidRangeEvent?.remove();
    this.beaconsServiceDidConnect?.remove();
    this.authStateDidRangeEvent?.remove();
  }

  onTransmitterStatusChanged = status => {
    this.setState({isTransmitterEnable: status});

    // Monitor beacons inside the region
    if (Platform.OS == 'android') {
      BeaconBroadcast.checkTransmissionSupported()
        .then(() => {
          BeaconBroadcast.stopAdvertisingBeacon();
          console.log('Beacons monitoring stopped!');
          if (status) {
            // this.triggerNotification('New Beacon Detected',  '')
            BeaconBroadcast.startAdvertisingBeaconWithString(
              this.state.uuid,
              this.state.identifier,
              0,
              0,
            );
            console.log('Beacons monitoring started!');
          }
        })
        .catch(error => {
          console.log(`Beacons monitoring not started, error: ${error}`);
          this.exceptionAlert('Beacon Transmitter', error);
        });
    } else if (Platform.OS == 'ios') {
      BeaconBroadcast.stopAdvertisingBeacon();
      console.log('Beacons monitoring stopped!');

      if (status) {
        BeaconBroadcast.startAdvertisingBeaconWithString(
          this.state.uuid,
          this.state.identifier,
          0,
          0,
        );
        console.log('Beacons monitoring started!');
      }
    }
  };

  onListenerStatusChanged = async status => {
    this.setState({isListenerEnable: status});

    if (status) {
      this.setState({beacons: null});
      await this.startRanging();
    } else this.stopRanging();
  };

  beaconItemRender = item => {
    return (
      <View
        style={{flexDirection: 'row', marginHorizontal: 20, marginBottom: 10}}>
        <View style={{width: 50, alignItems: 'flex-end'}}>
          <Text style={{fontSize: 24, fontWeight: 'bold'}}>
            #{item.index + 1}
          </Text>
        </View>
        <View style={{flexDirection: 'column', paddingLeft: 20, flex: 1}}>
          <Text>UUID: {item.item.uuid}</Text>
          <View style={{flexDirection: 'row'}}>
            <Text
              style={{color: '#AAAAAA', textTransform: 'capitalize', flex: 1}}>
              {item.item.proximity}
            </Text>
            <Text style={{color: '#AAAAAA'}}>
              ~{item.item.distance.toFixed(2)}m
            </Text>
          </View>
          <Text style={{color: '#CCCCCC'}}>
            RSSI: {item.item.rssi}, Minor: {item.item.minor}, Major:{' '}
            {item.item.major}
          </Text>
        </View>
      </View>
    );
  };

  triggerNotification = (title, message) => {
    PushNotification.localNotification({
      channelId: 'beacon-app-channel-id',
      title,
      message,
    });
  };
  triggerNotificationIOS = (title, message) => {
    PushNotificationIOS.addNotificationRequest({
      threadId: 'beacon-app-channel-id',
      title,
      body: message,
    });
  };
  render() {
    return (
      <SafeAreaView style={{flex: 1, backgroundColor: 'white'}}>
        <StatusBar barStyle="default" backgroundColor="#10b0e6" />
        <View style={styles.headerBg}>
          <Text style={styles.headerTitle}>RN Beacon Reloaded</Text>
        </View>
        <View style={styles.content}>
          <View>
            <View
              style={{flexDirection: 'row', padding: 10, alignItems: 'center'}}>
              <Switch
                trackColor={{false: '#767577', true: '#81b0ff'}}
                thumbColor={
                  this.state.isTransmitterEnable ? '#00BFFF' : '#f4f3f4'
                }
                ios_backgroundColor="#3e3e3e"
                onValueChange={this.onTransmitterStatusChanged}
                value={this.state.isTransmitterEnable}
              />
              <Text style={{paddingLeft: 10, fontSize: 16}}>
                Enable transmitter
              </Text>
            </View>
            {this.state.isTransmitterEnable && (
              <View>
                <Text
                  style={{
                    paddingHorizontal: 10,
                    paddingBottom: 10,
                    color: '#AAAAAA',
                    alignSelf: 'center',
                  }}>
                  Your UUID: {this.state.uuid}
                </Text>
              </View>
            )}
          </View>
          <View style={{flex: 1}}>
            <View
              style={{flexDirection: 'row', padding: 10, alignItems: 'center'}}>
              <Switch
                trackColor={{false: '#767577', true: '#81b0ff'}}
                thumbColor={this.state.isListenerEnable ? '#00BFFF' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={this.onListenerStatusChanged}
                value={this.state.isListenerEnable}
              />
              <Text style={{paddingLeft: 10, fontSize: 16}}>
                Enable listener
              </Text>
            </View>
            {/* <TouchableOpacity
              style={{
                backgroundColor: 'blue',
                padding: 20,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => {
                this.triggerNotification(
                  'Sample Title',
                  'Sample Message to be shown as  notification',
                );
              }}>
              <Text style={{color: 'white', fontSize: 20}}>
                Click for Notification
              </Text>
            </TouchableOpacity> */}
            {this.state.isListenerEnable && (
              <View style={{flex: 1}}>
                <Text
                  style={{margin: 10, color: '#AAAAAA', alignSelf: 'center'}}>
                  Beacons nearby ({this.state.beacons?.length ?? 0})
                </Text>
                <FlatList
                  data={this.state.beacons}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={this.beaconItemRender}
                  nestedScrollEnabled></FlatList>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  headerBg: {
    backgroundColor: '#00BFFF',
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 15,
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 26,
  },
  content: {
    backgroundColor: 'white',
    flex: 1,
    marginTop: 10,
  },
});

export default App;
