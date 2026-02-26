<script setup lang="ts">
const props = defineProps({
  isMobileMenuOpen: {
    type: Boolean,
    default: false,
  },
})
</script>
<template>
  <svg
    v-if="!props.isMobileMenuOpen"
    class="h-6 w-6"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    aria-hidden="true"
  >
    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
  <svg
    v-else
    class="h-6 w-6"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    aria-hidden="true"
  >
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
</template>
