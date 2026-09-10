<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Expression;

/** A parsed expression, ready to run against any context. */
final class Compiled
{
	/**
	 * The distinct field names the expression reads, in the order they appear.
	 *
	 * @var list<string>
	 */
	public readonly array $dependencies;

	public function __construct(private readonly Node $root)
	{
		$names = [];
		self::collect($this->root, $names);
		$this->dependencies = array_values($names);
	}

	public function evaluate(Context $context): bool
	{
		return Evaluator::truth($this->root, $context);
	}

	/** @param array<string, string> $names */
	private static function collect(Node $node, array &$names): void
	{
		if ($node->kind === Node::NAME || $node->kind === Node::VALID) {
			$names[$node->text] = $node->text;
		}

		foreach ($node->children as $child) {
			self::collect($child, $names);
		}
	}
}
