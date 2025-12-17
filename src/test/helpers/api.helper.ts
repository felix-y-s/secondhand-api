export const getApiPath =
  (prefix: string, controllerPath: string) => (path: string) => {
    const normalizedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
    const normalizedControllerPath =
      controllerPath === '' || controllerPath.startsWith('/')
        ? controllerPath
        : `/${controllerPath}`;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedPrefix}${normalizedControllerPath}${normalizedPath}`;
  };
