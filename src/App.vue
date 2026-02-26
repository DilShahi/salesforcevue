<script setup lang="ts">
import { RouterView } from 'vue-router'
import NavbarPage from './layout/NavbarPage.vue'
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <NavbarPage />

    <main class="mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
      <RouterView />
    </main>
  </div>
</template>
