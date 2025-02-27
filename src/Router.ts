import type {
  HttpRequest,
  HttpResponse,
  RequestResponse,
} from './RequestResponse';

// Base types for routes
type RouteHandler<TReq, TRes> = (
  req: HttpRequest<TReq>
) => Promise<HttpResponse<TRes>>;

type Route<TReq, TRes> = {
  path: string;
  handler: RouteHandler<TReq, TRes>;
};

// Shape of router's routes
type RouterRoutes = {
  GET: Record<string, Route<any, any>>;
  POST: Record<string, Route<any, any>>;
  PUT: Record<string, Route<any, any>>;
  DELETE: Record<string, Route<any, any>>;
};

// Router state
type RouterState = {
  routes: RouterRoutes;
};

// Helper type to extract response type from a route
type RouteResponse<T> = T extends Route<any, infer R> ? R : never;

// Helper type to extract request type from a route
type RouteRequest<T> = T extends Route<infer R, any> ? R : never;

// Type to infer the full router type including response types
export type InferRouterType<T> = {
  [Method in keyof T]: {
    [Path in keyof T[Method]]: {
      request: RouteRequest<T[Method][Path]>;
      response: RouteResponse<T[Method][Path]>;
    };
  };
};

// Define the router interface with generic methods
export interface Router {
  get<Path extends string, TRes = any>(
    path: Path,
    handler: RouteHandler<void, TRes>
  ): Router;

  post<Path extends string, TReq = any, TRes = any>(
    path: Path,
    handler: RouteHandler<TReq, TRes>
  ): Router;

  put<Path extends string, TReq = any, TRes = any>(
    path: Path,
    handler: RouteHandler<TReq, TRes>
  ): Router;

  delete<Path extends string, TReq = any, TRes = any>(
    path: Path,
    handler: RouteHandler<TReq, TRes>
  ): Router;

  handleRequest(request: HttpRequest<any>): Promise<HttpResponse<any>>;
  getRoutes(): RouterRoutes;
  initialize(requestResponse: RequestResponse): Router;
}

export const createRouter = (): Router => {
  const state: RouterState = {
    routes: {
      GET: {},
      POST: {},
      PUT: {},
      DELETE: {},
    },
  };

  const router: Router = {
    // GET route handler
    get: <Path extends string, TRes = any>(
      path: Path,
      handler: RouteHandler<void, TRes>
    ) => {
      state.routes.GET[path] = { path, handler } as Route<void, TRes>;
      return router;
    },

    // POST route handler
    post: <Path extends string, TReq = any, TRes = any>(
      path: Path,
      handler: RouteHandler<TReq, TRes>
    ) => {
      state.routes.POST[path] = { path, handler } as Route<TReq, TRes>;
      return router;
    },

    // PUT route handler
    put: <Path extends string, TReq = any, TRes = any>(
      path: Path,
      handler: RouteHandler<TReq, TRes>
    ) => {
      state.routes.PUT[path] = { path, handler } as Route<TReq, TRes>;
      return router;
    },

    // DELETE route handler
    delete: <Path extends string, TReq = any, TRes = any>(
      path: Path,
      handler: RouteHandler<TReq, TRes>
    ) => {
      state.routes.DELETE[path] = { path, handler } as Route<TReq, TRes>;
      return router;
    },

    // Handle incoming requests
    handleRequest: async (
      request: HttpRequest<any>
    ): Promise<HttpResponse<any>> => {
      const routes = state.routes[request.method];
      const route = routes[request.path];

      if (!route) {
        return { status: 404 };
      }

      return route.handler(request as any);
    },

    // Get all routes (useful for debugging)
    getRoutes: () => state.routes,

    // Initialize request handler
    initialize: (requestResponse: RequestResponse) => {
      requestResponse.onRequest(async (request, _pairingInfo, sendResponse) => {
        const response = await router.handleRequest(request);
        await sendResponse(response);
      });
      return router;
    },
  };

  return router;
};
