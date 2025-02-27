# rn-local-p2p

Peer to peer connection library over a local network, WiFi, without internet access using UDP

> **Warning**: This library is in pre-release state and should be used with caution. It has not been tested at scale in production environments, and both the API and internal implementations are subject to frequent changes. Use at your own risk.

**TODO**:

- Improve test coverage
- Add created and updated at timestamps to pairings

## Installation

```sh
npm install rn-local-p2p
```

## Usage

```js
// ...
```

#### Creating Router

```ts
import { createRouter } from './Router';
import { RequestResponse } from './RequestResponse';

// Define your types
interface Message {
  id: string;
  content: string;
}

const router = createRouter()
  .get('/messages', async () => ({
    status: 200,
    body: [] as Message[],
  }))
  .post('/messages', async (req: HttpRequest<{ content: string }>) => ({
    status: 201,
    body: { id: '123', content: req.body.content } as Message,
  }));

router.initialize(yourRequestResponseInstance);
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)

---

## Installation

1.  Install the library:

    ```bash
    npm install your-library-name
    ```

2.  **React Native Specific Setup (Required):**

    Because this library uses Node.js core modules (specifically, `crypto` and its dependencies), you _must_ use `rn-nodeify` to make it compatible with React Native. This step is _essential_ for your application to build and run correctly.

    a. Install `rn-nodeify` as a dev dependency in your _application_:

    ```bash
    npm install --save-dev rn-nodeify
    ```

    b. Run `rn-nodeify` to install the necessary shims and configure your `package.json`:

    ```bash
    npx rn-nodeify --install "stream,buffer,events,crypto,vm,process" --hack
    ```

    c. Ensure that your `package.json` has been modified correctly. It should have:
    _ `stream-browserify`, `buffer`, `events`, `vm-browserify` and `process` listed under `dependencies`.
    _ `rn-nodeify` listed under `devDependencies`.
    _ A `browser` field mapping `stream`, `buffer`, `events`, `crypto`,`vm`, and `process` to their respective browserify shims.
    _ A `postinstall` script in the `scripts` section that runs `rn-nodeify`.

    d. **Important:** After running `rn-nodeify`, you _must_ clean your build and restart the Metro bundler:

    - Stop the Metro bundler (Ctrl+C or Cmd+C).
    - Clear Watchman watches: `watchman watch-del-all`
    - Delete the `node_modules` directory: `rm -rf node_modules`
    - Clear Metro Cache: `npx react-native start --reset-cache`
    - Reinstall dependencies: `npm install`
    - (iOS Only) Clean and rebuild your iOS project: `cd ios && rm -rf Pods && rm -rf build && pod install && cd ..`
    - Restart the Metro bundler: `npm start`
    - Rebuild your application: `npx react-native run-android` or `npx react-native run-ios`

3.  Import `react-native-get-random-values`:
    Add this line at the very top of the root file (`index.js`):
    ```js
    import 'react-native-get-random-values';
    ```
