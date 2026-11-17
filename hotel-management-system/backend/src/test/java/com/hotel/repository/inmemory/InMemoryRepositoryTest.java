package com.hotel.repository.inmemory;

import com.hotel.entity.Identifiable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryRepositoryTest {

    @Data
    @Builder(toBuilder = true)
    @AllArgsConstructor
    static class Sample implements Identifiable {
        private String id;
        private String name;
    }

    static class SampleRepository extends InMemoryRepository<Sample> {
        SampleRepository() {
            super("SM", s -> s.toBuilder().build());
        }
    }

    private SampleRepository repository;

    @BeforeEach
    void setUp() {
        repository = new SampleRepository();
    }

    @Test
    void saveAssignsSequentialIdsWhenMissing() {
        Sample first = repository.save(Sample.builder().name("a").build());
        Sample second = repository.save(Sample.builder().name("b").build());

        assertThat(first.getId()).isEqualTo("SM-0001");
        assertThat(second.getId()).isEqualTo("SM-0002");
        assertThat(repository.count()).isEqualTo(2);
    }

    @Test
    void generatedIdsSkipPastSeededIds() {
        repository.save(new Sample("SM-0040", "seeded"));

        assertThat(repository.save(Sample.builder().name("new").build()).getId()).isEqualTo("SM-0041");
    }

    @Test
    void returnedEntitiesAreDetachedCopies() {
        Sample saved = repository.save(Sample.builder().name("original").build());
        saved.setName("mutated outside repository");

        assertThat(repository.findById(saved.getId())).get()
                .extracting(Sample::getName).isEqualTo("original");
    }

    @Test
    void findAllFiltersAndSortsById() {
        repository.save(new Sample("SM-0003", "keep"));
        repository.save(new Sample("SM-0001", "keep"));
        repository.save(new Sample("SM-0002", "drop"));

        assertThat(repository.findAll(s -> s.getName().equals("keep")))
                .extracting(Sample::getId).containsExactly("SM-0001", "SM-0003");
    }

    @Test
    void deleteByIdReportsWhetherSomethingWasRemoved() {
        Sample saved = repository.save(Sample.builder().name("x").build());

        assertThat(repository.deleteById(saved.getId())).isTrue();
        assertThat(repository.deleteById(saved.getId())).isFalse();
        assertThat(repository.existsById(saved.getId())).isFalse();
    }

    @Test
    void concurrentSavesProduceUniqueIds() throws InterruptedException {
        int threads = 16;
        int perThread = 250;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        Set<String> ids = ConcurrentHashMap.newKeySet();
        CountDownLatch start = new CountDownLatch(1);

        for (int t = 0; t < threads; t++) {
            pool.submit(() -> {
                start.await();
                for (int i = 0; i < perThread; i++) {
                    ids.add(repository.save(Sample.builder().name("n").build()).getId());
                }
                return null;
            });
        }
        start.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        assertThat(ids).hasSize(threads * perThread);
        assertThat(repository.count()).isEqualTo(threads * perThread);
    }
}
