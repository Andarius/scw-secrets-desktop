// Replaces @gpuix/native's napi-rs loader: Hermes executables only dlopen addons that are outside the bundle.
const binding = { exports: {} };
process.dlopen(binding, process.env.NAPI_RS_NATIVE_LIBRARY_PATH);
export const { AvailableUpdate, GpuixRenderer, TestGpuixRenderer, checkUpdate, hasTestGpuixRenderer } = binding.exports;
export const __napiBindingTarget = "native";
