# GPU plugins

`gpu-compute-test.json`には次のノードがあります。

```text
GPU Scale Array
CUDA External Task
OpenCL External Task
```

WebGPUノードはTauri WebView内で動作し、利用できない場合はCPUへフォールバックします。

CUDA/OpenCLノードは外部プロセスABIの前提実装です。実行前に各SDKでアダプターEXEをビルドしてください。

```text
cuda_adapter.cu
opencl_adapter.cpp
```

これらの外部アダプターはテスト骨格であり、実際のGPUカーネルは未実装です。
