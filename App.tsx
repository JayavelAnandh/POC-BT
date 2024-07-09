import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  Button,
  Platform,
  PermissionsAndroid,
  Alert,
  View,
  StyleSheet,
} from 'react-native';
import {BleManager, Device} from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';

const App: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const manager = useMemo(() => new BleManager(), []);

  // const mockDevices: Device[] = [
  //   {
  //     id: '1',

  //     localName: 'Device 1',
  //     manufacturerData: '',
  //     serviceData: {},
  //     serviceUUIDs: [],
  //     rssi: -50,
  //     mtu: 23,
  //     isConnectable: true,
  //     overflowServiceUUIDs: [],
  //     solicitedServiceUUIDs: [],
  //     txPowerLevel: null,
  //     uuids: [],
  //     connect: async () => ({} as Device),
  //     cancelConnection: async () => ({} as Device),
  //     discoverAllServicesAndCharacteristics: async () => ({} as Device),
  //     isConnected: async () => false,
  //     readCharacteristicForService: async () => ({} as any),
  //     readDescriptorForCharacteristic: async () => ({} as any),
  //     readRSSI: async () => -50,
  //     writeCharacteristicWithResponseForService: async () => ({} as any),
  //     writeCharacteristicWithoutResponseForService: async () => ({} as any),
  //     monitorCharacteristicForService: async () => ({remove: () => {}}),
  //     onDisconnected: (
  //       listener: (error: Error | null, device: Device | null) => void,
  //     ) => ({}),
  //   },
  //   {
  //     id: '2',
  //     name: 'Device 2',
  //     localName: 'Device 2',
  //     manufacturerData: '',
  //     serviceData: {},
  //     serviceUUIDs: [],
  //     rssi: -60,
  //     mtu: 23,
  //     isConnectable: true,
  //     overflowServiceUUIDs: [],
  //     solicitedServiceUUIDs: [],
  //     txPowerLevel: null,
  //     uuids: [],
  //     connect: async () => ({} as Device),
  //     cancelConnection: async () => ({} as Device),
  //     discoverAllServicesAndCharacteristics: async () => ({} as Device),
  //     isConnected: async () => false,
  //     readCharacteristicForService: async () => ({} as any),
  //     readDescriptorForCharacteristic: async () => ({} as any),
  //     readRSSI: async () => -60,
  //     writeCharacteristicWithResponseForService: async () => ({} as any),
  //     writeCharacteristicWithoutResponseForService: async () => ({} as any),
  //     monitorCharacteristicForService: async () => ({remove: () => {}}),
  //     onDisconnected: (
  //       listener: (error: Error | null, device: Device | null) => void,
  //     ) => ({}),
  //   },
  // ];

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED,
        );
        if (!allGranted) {
          Alert.alert('Permissions not granted');
          return false;
        }

        return true;
      } catch (err) {
        console.warn(err);
        Alert.alert('Permissions request failed');
        return false;
      }
    }
    return true;
  };

  const connectToDevice = useCallback(
    async (deviceId: string) => {
      try {
        // setConnectedDevice(mockDevices[0]);
        // await AsyncStorage.setItem('connectedDeviceId', mockDevices[0].id);
        const device = await manager.connectToDevice(deviceId);
        await device.discoverAllServicesAndCharacteristics();
        setConnectedDevice(device);
        await AsyncStorage.setItem('connectedDeviceId', device.id);
        console.log('Connected to device:', device.id);
      } catch (error) {
        Alert.alert('Failed to connect to device:', deviceId);
        console.error('Failed to connect to device:', error);
      }
    },
    [manager],
  );
  const refreshAvailableDevices = () => {
    try {
      setDevices([]);
      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Device Scan Error:', error);
          return;
        }
        if (device) {
          console.log('Found Device:', device.name, device.id);
          setDevices(prevDevices => {
            // Add all found devices to the state
            return [...prevDevices, device];
          });
        }
      });

      setTimeout(() => {
        console.log('Scanning ended');
        manager.stopDeviceScan();
      }, 10000); // Stop scanning after 10 seconds
    } catch (error) {
      console.error('Failed to refresh', error);
      Alert.alert('Failed to refresh');
    }
  };
  const scanAndConnect = useCallback(async () => {
    const permissionsGranted = await requestPermissions();
    if (!permissionsGranted) {
      return;
    }

    try {
      const storedDeviceId = await AsyncStorage.getItem('connectedDeviceId');
      console.log(storedDeviceId, 'localStorage');
      console.log('Stored Device ID:', storedDeviceId);
      if (storedDeviceId) {
        await connectToDevice(storedDeviceId);
      } else {
        // Clear the devices state before starting a new scan
        setDevices([]);

        manager.startDeviceScan(null, null, (error, device) => {
          if (error) {
            console.error('Device Scan Error:', error);
            Alert.alert('Device Scan Error');
            return;
          }
          if (device) {
            console.log('Found Device:', device.name, device.id);
            setDevices(prevDevices => {
              // Add all found devices to the state
              return [...prevDevices, device];
            });
          }
        });

        setTimeout(() => {
          console.log('Scanning ended');
          manager.stopDeviceScan();
        }, 10000); // Stop scanning after 10 seconds
      }
    } catch (error) {
      console.error('Failed to retrieve the connected device ID:', error);
      Alert.alert('Failed to retrieve the connected device ID');
    }
  }, [manager, connectToDevice]);

  useEffect(() => {
    const subscription = manager.onStateChange(async state => {
      console.log('Bluetooth State:', state);
      if (state === 'PoweredOn') {
        try {
          await requestPermissions();
          scanAndConnect();
          subscription.remove();
        } catch (error) {
          console.log(error, 'Error');
        }
      } else {
        console.error('Bluetooth is not enabled or supported');
        Alert.alert('Error', 'Bluetooth is not enabled or supported');
      }
    }, true);

    return () => {
      manager.stopDeviceScan();
      subscription.remove();
    };
  }, [manager, scanAndConnect]);

  const disconnectFromDevice = async () => {
    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
        setConnectedDevice(null);
        await AsyncStorage.removeItem('connectedDeviceId');
        console.log('Disconnected from device');
        Alert.alert('Disconnected from device');
        refreshAvailableDevices();
      } catch (error) {
        console.error('Failed to disconnect from device:', error);
        Alert.alert('Error', 'Failed to disconnect from device');
      }
    }
  };

  const handleDevicePress = (device: Device) => {
    connectToDevice(device.id);
  };

  const forgetDevice = async () => {
    disconnectFromDevice();
    await AsyncStorage.removeItem('connectedDeviceId');
  };
  var styles = StyleSheet.create({
    topBar: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    infoBar: {
      display: 'flex',
      fontSize: 18,
      textDecorationLine: 'underline',
      fontWeight: '800',
    },
    devices: {
      display: 'flex',
      fontSize: 16,
      margin: 3,
      marginLeft: 8,
      fontWeight: 'bold',
      color: 'black',
      fontFamily: 'Helvetica',
    },
    disconnect: {
      display: 'flex',
      justifyContent: 'center',
      flexDirection: 'column',
      marginTop: 5,
    },
    connectedDevice: {
      borderColor: 'black',
      borderWidth: 1,
      margin: 7,
      padding: 3,
    },
    btn: {
      backgroundColor: 'violet',
      margin: 5,
      borderRadius: 5,
      padding: 3,
    },
    btn2: {
      backgroundColor: 'red',
      fontWeight: 'bold',
      color: 'white',
      padding: 5,
      textAlign: 'center',
    },
    condition: {
      backgroundColor: 'white',
      fontSize: 16,
      marginLeft: 8,
      fontWeight: 'bold',
      color: 'black',
      fontFamily: 'Helvetica',
    },
  });
  return (
    <SafeAreaView>
      <View style={styles.topBar}>
        <Button
          title="🔃 Refresh"
          onPress={() => {
            refreshAvailableDevices();
          }}
        />
      </View>

      <Text style={styles.infoBar}>Nearby Bluetooth Devices :</Text>

      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <TouchableOpacity
            onPress={() => handleDevicePress(item)}
            style={styles.btn}>
            <Text
              style={
                connectedDevice?.id === item.id
                  ? (styles.devices, styles.condition)
                  : styles.devices
              }>
              {item.name
                ? item.name
                : `Unnamed Device , ${item?.id} , ${item?.localName}`}
            </Text>
          </TouchableOpacity>
        )}
      />
      {connectedDevice && connectedDevice !== null && (
        <View style={styles.connectedDevice}>
          <Text style={styles.devices}>
            Connected to:{' '}
            {connectedDevice.name ? connectedDevice.name : 'Unnamed Device'}
          </Text>
          <View style={styles.disconnect}>
            <Button title="Disconnect" onPress={disconnectFromDevice} />
            <TouchableOpacity onPress={forgetDevice}>
              <Text style={styles.btn2}>Forget</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default App;
