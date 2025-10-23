# Redis Configuration Guide

This document explains the Redis configuration for AutoPWN across different environments and the security hardening measures implemented.

## Table of Contents

- [Overview](#overview)
- [Configuration Files](#configuration-files)
- [Production Configuration](#production-configuration)
- [Security Hardening](#security-hardening)
- [Performance Tuning](#performance-tuning)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

AutoPWN uses Redis for:
- **Rate Limiting**: Track API request rates per IP/user
- **Job Queues**: BullMQ background job processing
- **Session Storage**: (Optional) Better Auth session caching
- **Cache**: General-purpose caching

Different environments have different Redis configurations optimized for their use cases.

## Configuration Files

### `config/redis.conf` (Development)
- **Purpose**: Local development
- **Persistence**: Enabled with RDB + AOF
- **Security**: Password optional
- **Memory**: 256MB limit

### `config/redis-test.conf` (Testing)
- **Purpose**: Unit and integration tests
- **Persistence**: Disabled for speed
- **Security**: No password
- **Memory**: 128MB limit (ephemeral)

### `config/redis-prod.conf` (Production)
- **Purpose**: Production deployment
- **Persistence**: RDB + AOF with optimized settings
- **Security**: Password required, dangerous commands disabled
- **Memory**: 512MB limit with LRU eviction

## Production Configuration

### Security Hardening

The production Redis configuration implements multiple layers of security:

#### 1. Network Security

```conf
bind 0.0.0.0
port 6379
protected-mode yes
```

- **bind**: Binds to all interfaces (container network)
- **protected-mode**: Requires password authentication
- **Docker**: Ports bound to localhost only (`127.0.0.1:6379`)

#### 2. Authentication

Password is set via command-line argument (not in config file):

```bash
# In docker-compose.prod.yml
redis-server /path/to/redis.conf --requirepass ${REDIS_PASSWORD}
```

**Why not in config file?**
- Prevents password from being committed to version control
- Allows dynamic password injection from environment variables
- Follows security best practices

#### 3. Dangerous Commands Disabled

The following commands are completely disabled in production:

```conf
# Disabled for security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
rename-command DEBUG ""

# Renamed for safety (requires special access)
rename-command SHUTDOWN SHUTDOWN_SAFE
```

**Rationale:**
- `FLUSHDB`/`FLUSHALL`: Prevent accidental data loss
- `CONFIG`: Prevent runtime configuration changes
- `DEBUG`: Prevent information disclosure
- `SHUTDOWN`: Renamed to prevent accidental shutdown

#### 4. Connection Limits

```conf
timeout 300              # Close idle connections after 5 minutes
tcp-keepalive 300        # Send TCP keepalive every 5 minutes
tcp-backlog 511          # Maximum queued connections
maxclients 10000         # Maximum concurrent clients
```

### Persistence Configuration

Production uses both RDB and AOF for maximum data durability:

#### RDB (Point-in-Time Snapshots)

```conf
save 900 1               # Save if 1 key changed in 15 minutes
save 300 10              # Save if 10 keys changed in 5 minutes
save 60 10000            # Save if 10,000 keys changed in 1 minute

stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data
```

**Benefits:**
- Fast recovery from snapshots
- Compressed backups
- Checksum verification

#### AOF (Append-Only File)

```conf
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-load-truncated yes
aof-use-rdb-preamble yes
```

**Benefits:**
- Maximum durability (1 second data loss max)
- Automatic compaction
- RDB preamble for faster loading

### Memory Management

```conf
maxmemory 512mb
maxmemory-policy allkeys-lru
maxmemory-samples 5
```

**Policy Explanation:**
- **allkeys-lru**: Evict least recently used keys when memory limit reached
- **maxmemory-samples**: Sample 5 keys for LRU (good balance of accuracy vs performance)

**Why LRU?**
- AutoPWN's caching and rate limiting naturally benefits from LRU
- Old rate limit records automatically expire
- Cache entries for inactive users are evicted

### Performance Optimization

#### Active Defragmentation

```conf
activedefrag yes
active-defrag-ignore-bytes 100mb
active-defrag-threshold-lower 10
active-defrag-threshold-upper 100
active-defrag-cycle-min 5
active-defrag-cycle-max 75
```

**Benefits:**
- Reduces memory fragmentation over time
- Improves long-term stability
- Minimal performance impact

#### Lazy Freeing

```conf
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes
```

**Benefits:**
- Non-blocking key deletion
- Better performance under load
- Prevents latency spikes

#### I/O Threading

```conf
io-threads 4
io-threads-do-reads yes
```

**Benefits:**
- Parallel I/O processing
- Better CPU utilization
- Higher throughput

## Security Hardening

### Production Deployment Checklist

- [ ] Set strong `REDIS_PASSWORD` (32+ characters)
- [ ] Verify password is set: `docker-compose logs redis | grep -i password`
- [ ] Test authentication: `redis-cli -a $REDIS_PASSWORD ping`
- [ ] Confirm dangerous commands disabled
- [ ] Enable TLS (if Redis exposed outside Docker network)
- [ ] Set up monitoring and alerting
- [ ] Configure automatic backups

### Testing Security

```bash
# 1. Verify password is required
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
# Expected: (error) NOAUTH Authentication required.

# 2. Verify password works
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" ping
# Expected: PONG

# 3. Verify FLUSHDB is disabled
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" FLUSHDB
# Expected: (error) ERR unknown command 'FLUSHDB'

# 4. Verify CONFIG is disabled
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" CONFIG GET requirepass
# Expected: (error) ERR unknown command 'CONFIG'
```

### Password Rotation

To rotate the Redis password in production:

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update .env.production
sed -i.bak "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$NEW_PASSWORD/" .env.production

# 3. Update application configuration
# Update REDIS_URL and REDIS_PASSWORD in application environment

# 4. Restart Redis with new password
docker-compose -f docker-compose.prod.yml up -d redis

# 5. Restart application services
docker-compose -f docker-compose.prod.yml restart api worker

# 6. Verify connectivity
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a "$NEW_PASSWORD" ping
```

## Performance Tuning

### Memory Usage Monitoring

```bash
# Check current memory usage
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" INFO memory

# Key metrics to monitor:
# - used_memory_human: Current memory usage
# - used_memory_peak_human: Peak memory usage
# - maxmemory_human: Memory limit
# - mem_fragmentation_ratio: Fragmentation (should be close to 1.0)
```

### Slow Query Log

```conf
slowlog-log-slower-than 10000  # Log queries > 10ms
slowlog-max-len 128             # Keep last 128 slow queries
```

Check slow queries:

```bash
# View slow query log
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" SLOWLOG GET 10

# Clear slow query log
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" SLOWLOG RESET
```

### Performance Metrics

```bash
# Get comprehensive stats
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" INFO stats

# Key metrics:
# - total_commands_processed: Commands executed
# - instantaneous_ops_per_sec: Current throughput
# - rejected_connections: Connections rejected (indicates limit hit)
# - evicted_keys: Keys evicted due to memory limit
```

## Monitoring

### Health Checks

Docker Compose includes automated health checks:

```yaml
healthcheck:
  test: ["CMD", "sh", "-c", "redis-cli ${REDIS_PASSWORD:+-a \"$REDIS_PASSWORD\"} ping"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s
```

### Key Metrics to Monitor

1. **Memory Usage**: Should stay below `maxmemory` limit
2. **Eviction Rate**: Frequent evictions may indicate memory limit too low
3. **Hit Rate**: `keyspace_hits / (keyspace_hits + keyspace_misses)`
4. **Connections**: Monitor `connected_clients` for connection leaks
5. **Replication Lag**: If using replicas (future enhancement)

### Alerting Thresholds

Recommended alert conditions:

- Memory usage > 90% of maxmemory
- Eviction rate > 100 keys/second
- Cache hit rate < 80%
- Connected clients > 9000 (approaching maxclients limit)
- Rejected connections > 0

## Troubleshooting

### Connection Issues

**Problem**: Application can't connect to Redis

```bash
# 1. Check Redis is running
docker-compose ps redis

# 2. Check Redis logs
docker-compose logs redis | tail -50

# 3. Test from application container
docker-compose exec api sh -c 'apk add redis && redis-cli -h redis -a $REDIS_PASSWORD ping'

# 4. Verify password in application config
docker-compose exec api env | grep REDIS
```

### Memory Issues

**Problem**: Redis running out of memory

```bash
# 1. Check current memory usage
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" INFO memory | grep used_memory_human

# 2. Check eviction stats
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" INFO stats | grep evicted_keys

# 3. Increase memory limit (if needed)
# Edit docker-compose.prod.yml:
# --maxmemory 1024mb  # Double the limit

# 4. Restart Redis
docker-compose up -d redis
```

### Performance Issues

**Problem**: Redis responding slowly

```bash
# 1. Check slow query log
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" SLOWLOG GET 10

# 2. Check memory fragmentation
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" INFO memory | grep fragmentation

# 3. If fragmentation > 1.5, consider restart
docker-compose restart redis

# 4. Check for blocked clients
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" CLIENT LIST | grep blocked
```

### Persistence Issues

**Problem**: Data not persisting across restarts

```bash
# 1. Check last save time
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" LASTSAVE

# 2. Check AOF status
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" INFO persistence

# 3. Manually trigger save
docker-compose exec redis redis-cli -a "$REDIS_PASSWORD" BGSAVE

# 4. Check volume mount
docker volume inspect autopwn_redis_data
```

## Best Practices

### Development

- Use default redis.conf with persistence enabled
- Optional password (set for testing auth flows)
- Monitor memory usage during development

### Testing

- Use redis-test.conf with persistence disabled
- No password required
- Fast teardown with tmpfs

### Production

- **Always** set REDIS_PASSWORD
- Enable persistence (RDB + AOF)
- Monitor memory, evictions, and performance
- Regular backups of RDB snapshots
- Consider Redis Sentinel for high availability (future)

## References

- [Redis Security Documentation](https://redis.io/docs/management/security/)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Redis Memory Optimization](https://redis.io/docs/management/optimization/memory-optimization/)
- [Docker Redis Best Practices](https://docs.docker.com/samples/redis/)

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
