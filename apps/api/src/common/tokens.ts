/** DI 토큰. 모든 생성자 주입은 @Inject로 명시해 데코레이터 메타데이터(emitDecoratorMetadata)에 의존하지 않는다. */
export const DB = Symbol('DB');
export const CONFIG = Symbol('CONFIG');
