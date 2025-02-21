// import PolyfillCrypto from 'react-native-webview-crypto';
import QRCode from 'react-native-qrcode-svg';
import { useState } from 'react';
import { Camera, CameraType } from 'react-native-camera-kit';
import {
  Text,
  View,
  StyleSheet,
  Dimensions,
  Button,
  TextInput,
  Alert,
} from 'react-native';
import { multiply, createRouter, useP2PCommunication } from 'rn-local-p2p';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: WIDTH } = Dimensions.get('screen');

const result = multiply(3, 7);

type Todo = {
  id: string; // currently just Math.radom() stringified
  title: string;
  status: 'todo' | 'done';
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: number; // UTC timestamp
  updatedAt: number; // UTC timestamp
};

// Single todo item component
const TodoItem = ({
  todo,
  onToggleStatus,
  onShare,
}: {
  todo: Todo;
  onToggleStatus: () => void;
  onShare: () => void;
}) => {
  return (
    <View style={styles.todoItem}>
      <View style={styles.todoMain}>
        <Text
          style={[styles.todoTitle, todo.status === 'done' && styles.todoDone]}
        >
          {todo.title}
        </Text>
        {todo.description && (
          <Text style={styles.todoDescription}>{todo.description}</Text>
        )}
      </View>
      <View style={styles.todoActions}>
        <Button
          title={todo.status === 'todo' ? 'Done' : 'Undo'}
          onPress={onToggleStatus}
        />
        <Button title="Share" onPress={onShare} />
      </View>
    </View>
  );
};

type Message = {
  content: string;
  timestamp: number;
  sender: string;
  deviceId: string;
};

export default function App() {
  // default shows the list of todo items with optional add todo screen
  // devices, show the list of todo items with the option to open camera and scan another device's QR code
  const [screenMode, setScreenMode] = useState<
    'camera' | 'devices' | 'default' | 'add-todo' | 'share-todo'
  >('default');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [message, setMessage] = useState<string>('');

  // Create router with access to todos state
  const router = createRouter()
    .post('/message', async (req) => {
      const message = req.body as Message;
      // Handle message...
      return {
        status: 200,
        body: { success: true },
      };
    })
    .get('/messages', async () => ({
      status: 200,
      body: [],
    }))
    .get<string, Todo>('/todos/:id', async (req) => {
      const todoId = req.path.split('/').pop(); // Get the ID from the path
      const todo = todos.find((t) => t.id === todoId);

      if (!todo) {
        return {
          status: 404,
          body: undefined,
        };
      }

      return {
        status: 200,
        body: todo,
      };
    })
    .get<string, Todo[]>('/todos', async () => ({
      status: 200,
      body: todos,
    }))
    .post<'/todos/share', Todo, { success: boolean }>(
      '/todos/share',
      async (req) => {
        const newTodo = req.body;

        // Add the received todo to our list if it doesn't exist
        if (!todos.find((t) => t.id === newTodo?.id)) {
          // @ts-expect-error newTodo is not a Todo
          setTodos((prev) => [...prev, newTodo]);
        }

        return {
          status: 200,
          body: { success: true },
        };
      }
    );

  const [
    { myIpAddress, qrCode, pairedDevices },
    { generateQRCode, scanQRCode, removePairedDevice, sendRequest },
  ] = useP2PCommunication({
    router,
    storage: AsyncStorage,
    port: 12345,
    password: 'password',
    salt: 'salt',
  });

  // Helper function to send a todo to one or all devices
  const shareTodoWithDevices = async (todo: Todo, targetDeviceId?: string) => {
    const devices = targetDeviceId
      ? pairedDevices.filter((d) => d.id === targetDeviceId)
      : pairedDevices;

    const sharePromises = devices.map((device) =>
      sendRequest<Todo, { success: boolean }>(
        'POST',
        '/todos/share',
        device.id,
        todo
      ).catch((error) => {
        console.error(`Failed to share todo with device ${device.id}:`, error);
        return { success: false };
      })
    );

    const results = await Promise.all(sharePromises);
    const successCount = results.filter((r) => r.success).length;

    if (successCount === 0) {
      Alert.alert('Share Failed', 'Failed to share todo with any devices');
    } else if (successCount < devices.length) {
      Alert.alert(
        'Partial Success',
        `Shared todo with ${successCount} out of ${devices.length} devices`
      );
    } else {
      Alert.alert(
        'Success',
        `Shared todo with ${successCount} device${successCount > 1 ? 's' : ''}`
      );
    }
  };

  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
  });

  const addTodo = () => {
    const todo: Todo = {
      id: String(Math.random()),
      title: newTodo.title,
      description: newTodo.description,
      priority: newTodo.priority,
      status: 'todo',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setTodos([...todos, todo]);
    setNewTodo({ title: '', description: '', priority: 'medium' });
    setScreenMode('default');
  };

  const toggleTodoStatus = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              status: todo.status === 'todo' ? 'done' : 'todo',
              updatedAt: Date.now(),
            }
          : todo
      )
    );
  };

  const sendMessage = (a: any, b: any) => {};

  const shareTodo = async (todo: Todo, deviceId: string) => {
    if (!deviceId) {
      Alert.alert(
        'No Device Selected',
        'Please select a device to share with.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await shareTodoWithDevices(todo, deviceId);
    } catch (error) {
      Alert.alert('Error', 'Failed to share todo. Please try again.');
    }
  };

  const handleShareTodo = (todo: Todo) => {
    if (pairedDevices.length === 0) {
      Alert.alert(
        'No Devices Connected',
        'Please scan a QR code from another device first.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedTodo(todo);
    setScreenMode('share-todo');
  };

  if (screenMode === 'camera') {
    return (
      <>
        <Camera
          // Barcode props
          scanBarcode={true}
          cameraType={CameraType.Back} // front/back(default)
          flashMode="auto"
          onReadCode={(event) => {
            const value = event.nativeEvent.codeStringValue;
            if (value) {
              scanQRCode(value);
              setScreenMode('default');
            }
          }}
          style={StyleSheet.absoluteFill}
          showFrame={true} // (default false) optional, show frame with transparent layer (qr code or barcode will be read on this area ONLY), start animation for scanner, that stops when a code has been found. Frame always at center of the screen
          // laserColor="red" // (default red) optional, color of laser in scanner frame
          frameColor="white" // (default white) optional, color of border of scanner frame
        />

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            width: '100%',
            position: 'absolute',
            bottom: 20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Button title="Cancel" onPress={() => setScreenMode('default')} />
        </View>
      </>
    );
  }

  if (screenMode === 'add-todo') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Add New Todo</Text>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={newTodo.title}
            onChangeText={(text) => setNewTodo({ ...newTodo, title: text })}
            placeholder="Todo title"
          />
          <TextInput
            style={styles.input}
            value={newTodo.description}
            onChangeText={(text) =>
              setNewTodo({ ...newTodo, description: text })
            }
            placeholder="Description (optional)"
            multiline
          />
          <View style={styles.buttonContainer}>
            <Button title="Cancel" onPress={() => setScreenMode('default')} />
            <Button
              title="Add Todo"
              onPress={addTodo}
              disabled={!newTodo.title.trim()}
            />
          </View>
        </View>
      </View>
    );
  }

  if (screenMode === 'share-todo' && selectedTodo) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Share Todo</Text>
        <Text style={styles.subHeader}>Select a device to share with:</Text>
        {pairedDevices.map((device) => (
          <View key={device.id} style={styles.deviceItem}>
            <Text style={styles.deviceName}>{device.name}</Text>
            <View style={styles.deviceActions}>
              <Button
                title="Share"
                onPress={() => {
                  shareTodo(selectedTodo, device.id);
                  setScreenMode('default');
                  setSelectedTodo(null);
                }}
              />
            </View>
          </View>
        ))}
        <Button
          title="Cancel"
          onPress={() => {
            setScreenMode('default');
            setSelectedTodo(null);
          }}
        />
      </View>
    );
  }

  if (screenMode === 'devices') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Connected Devices</Text>
        {pairedDevices.length === 0 ? (
          <Text style={styles.emptyText}>No devices connected</Text>
        ) : (
          pairedDevices.map((device) => (
            <View key={device.id} style={styles.deviceItem}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <View style={styles.deviceActions}>
                <Button
                  title="Remove"
                  onPress={() => removePairedDevice(device.id)}
                  color="#ff4444"
                />
              </View>
            </View>
          ))
        )}
        <View style={styles.buttonContainer}>
          <Button
            title="Scan QR Code"
            onPress={() => setScreenMode('camera')}
          />
          <Button title="Back" onPress={() => setScreenMode('default')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Todo List</Text>
        <View style={styles.headerButtons}>
          <Button title="Devices" onPress={() => setScreenMode('devices')} />
          <Button title="Add Todo" onPress={() => setScreenMode('add-todo')} />
        </View>
      </View>

      {todos.length === 0 ? (
        <Text style={styles.emptyText}>No todos yet</Text>
      ) : (
        <View style={styles.todoList}>
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggleStatus={() => toggleTodoStatus(todo.id)}
              onShare={() => handleShareTodo(todo)}
            />
          ))}
        </View>
      )}
      <View style={styles.buttonContainer}>
        <Button title="Scan Device" onPress={() => setScreenMode('camera')} />
        <Button title="Generate QR" onPress={generateQRCode} />
      </View>

      {qrCode && (
        <View style={styles.qrContainer}>
          <QRCode value={qrCode} size={WIDTH / 2} />
        </View>
      )}

      <Text>My IP: {myIpAddress}</Text>

      {/* <View
        style={{
          paddingVertical: 20,
          backgroundColor: 'white',
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {qrCode && <QRCode value={qrCode} size={WIDTH - 40} />}
      </View> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  todoList: {
    flex: 1,
  },
  todoItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  todoMain: {
    flex: 1,
    marginRight: 10,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  todoDone: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  todoDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  todoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  qrContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    marginBottom: 15,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f8f8',
    marginVertical: 5,
    borderRadius: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  subHeader: {
    fontSize: 16,
    marginBottom: 15,
    color: '#666',
  },
});
