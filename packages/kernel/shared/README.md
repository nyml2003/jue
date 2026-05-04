# `@jue/shared`

Kernel 共享定义包。存放编译器与运行时共同依赖的 opcode、result 类型、host contract 类型等不可变契约。

## 设计原则

- 只放类型和常量，不放逻辑
- 不依赖任何其他 workspace package
- 所有 kernel 包的上游
